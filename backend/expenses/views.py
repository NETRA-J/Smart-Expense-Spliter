from decimal import Decimal
from django.db import models
from .models import Group, Member, Expense, ExpenseSplit, Settlement

def recalculate_group_settlements(group):
    """
    Helper function to calculate member balances and automatically generate/sync
    pending Settlements based on the greedy debt simplification algorithm.
    """
    members = list(group.group_members.all())
    if not members:
        # If there are no members, clear all pending settlements
        group.settlements.filter(status='pending').delete()
        return []

    balances = {}
    for m in members:
        # Total paid as the payer of expenses in the group
        total_paid = Expense.objects.filter(group=group, paid_by=m).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        
        # Total owed as a participant of expenses splits in the group
        total_owes = ExpenseSplit.objects.filter(expense__group=group, member=m).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        
        # Total completed settlements sent by this member as payer
        settlements_sent = Settlement.objects.filter(group=group, payer=m, status='completed').aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        
        # Total completed settlements received by this member as payee
        settlements_received = Settlement.objects.filter(group=group, payee=m, status='completed').aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        
        # Net balance calculation: (Paid + Sent) - (Owed + Received)
        net_balance = (total_paid + settlements_sent) - (total_owes + settlements_received)
        
        # Total receivable is Net Balance if positive, else zero
        receivable = net_balance if net_balance > 0 else Decimal('0.00')
        
        balances[m.id] = {
            'member': m,
            'paid': total_paid,
            'owes': total_owes,
            'receivable': receivable,
            'net_balance': net_balance,
            'net_balance_abs': abs(net_balance),
        }

    # Extract debtors (net_balance < 0) and creditors (net_balance > 0)
    debtors = []
    creditors = []
    for member_id, data in balances.items():
        val = data['net_balance'].quantize(Decimal('0.01'))
        if val < Decimal('-0.005'):
            debtors.append({'id': member_id, 'balance': val})
        elif val > Decimal('0.005'):
            creditors.append({'id': member_id, 'balance': val})

    # Sort to optimize transactions (greedy simplification)
    debtors.sort(key=lambda x: x['balance'])  # Most negative first
    creditors.sort(key=lambda x: x['balance'], reverse=True)  # Most positive first

    recommended = []
    d_idx = 0
    c_idx = 0
    while d_idx < len(debtors) and c_idx < len(creditors):
        d = debtors[d_idx]
        c = creditors[c_idx]

        d_amt = -d['balance']
        c_amt = c['balance']

        settle_amt = min(d_amt, c_amt).quantize(Decimal('0.01'))
        if settle_amt > Decimal('0.00'):
            recommended.append((d['id'], c['id'], settle_amt))

        d['balance'] += settle_amt
        c['balance'] -= settle_amt

        if d['balance'].quantize(Decimal('0.01')) >= Decimal('-0.005'):
            d_idx += 1
        if c['balance'].quantize(Decimal('0.01')) <= Decimal('0.005'):
            c_idx += 1

    # Sync recommendations into the database as pending settlements
    active_pending_ids = []
    for payer_id, payee_id, amount in recommended:
        payer = Member.objects.get(id=payer_id)
        payee = Member.objects.get(id=payee_id)
        
        # Look for existing pending settlement
        settlement, created = Settlement.objects.get_or_create(
            group=group,
            payer=payer,
            payee=payee,
            status='pending',
            defaults={'amount': amount}
        )
        if not created:
            if settlement.amount != amount:
                settlement.amount = amount
                settlement.save()
        active_pending_ids.append(settlement.id)

    # Delete any pending settlements that are no longer recommended
    Settlement.objects.filter(group=group, status='pending').exclude(id__in=active_pending_ids).delete()

    return list(balances.values())
