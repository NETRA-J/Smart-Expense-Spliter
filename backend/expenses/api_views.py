from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.db import models
from django.core.mail import send_mail
from django.conf import settings
from decimal import Decimal, ROUND_DOWN

from .models import Group, Member, Expense, ExpenseSplit, Settlement, Budget, Invitation
from .serializers import (
    UserSerializer, RegisterSerializer, GroupSerializer, 
    MemberSerializer, ExpenseSerializer, ExpenseSplitSerializer, 
    SettlementSerializer, BudgetSerializer, InvitationSerializer
)
from .views import recalculate_group_settlements

# --- Authentication APIs ---

@api_view(['POST'])
@permission_classes([AllowAny])
def api_register(request):
    """
    Register a new user and return user details and authentication token.
    """
    import os
    log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'register_debug.log')
    try:
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"--- Registration Request Received ---\n")
            f.write(f"Data: {request.data}\n")
    except Exception:
        pass

    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        try:
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            try:
                with open(log_path, 'a', encoding='utf-8') as f:
                    f.write(f"Success: User created with ID {user.id}\n\n")
            except Exception:
                pass
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            try:
                import traceback
                with open(log_path, 'a', encoding='utf-8') as f:
                    f.write(f"Save Exception: {type(e)} {e}\n{traceback.format_exc()}\n\n")
            except Exception:
                pass
            return Response({'detail': f'Error saving user: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    try:
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"Validation Failed: {serializer.errors}\n\n")
    except Exception:
        pass
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    """
    Authenticate user credentials and return authentication token.
    """
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({'detail': 'Please provide both username and password.'}, status=status.HTTP_400_BAD_REQUEST)
        
    user = authenticate(username=username, password=password)
    if user is not None:
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_logout(request):
    """
    Logout user by deleting current auth token.
    """
    request.user.auth_token.delete()
    return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def api_me(request):
    """
    GET: Retrieve details of current authenticated user.
    PUT/PATCH: Update profile details.
    """
    if request.method == 'GET':
        return Response(UserSerializer(request.user, context={'request': request}).data)
        
    elif request.method in ['PUT', 'PATCH']:
        partial = (request.method == 'PATCH')
        serializer = UserSerializer(request.user, data=request.data, partial=partial, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_change_password(request):
    """
    POST: Change current user's password.
    """
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')
    
    if not current_password or not new_password or not confirm_password:
        return Response({'detail': 'All password fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
    user = request.user
    if not user.check_password(current_password):
        return Response({'current_password': 'Incorrect current password.'}, status=status.HTTP_400_BAD_REQUEST)
        
    if new_password != confirm_password:
        return Response({'confirm_password': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
        
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError
    try:
        validate_password(new_password, user)
    except ValidationError as e:
        return Response({'new_password': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
        
    user.set_password(new_password)
    user.save()
    
    return Response({'detail': 'Password changed successfully.'}, status=status.HTTP_200_OK)

def get_group_for_user(user, group_pk, require_creator=False):
    """
    Helper function to retrieve a Group.
    - If user is not the creator or a member, returns 404 (Not Found).
    - If require_creator is True and user is not the creator, returns 403 (Permission Denied).
    """
    from django.http import Http404
    from rest_framework.exceptions import PermissionDenied
    
    group = get_object_or_404(Group, pk=group_pk)
    
    is_creator = (group.created_by == user)
    is_member = group.members.filter(pk=user.pk).exists()
    
    if not (is_creator or is_member):
        raise Http404("Group not found")
        
    if require_creator and not is_creator:
        raise PermissionDenied("Only the group creator can perform this action.")
        
    return group


# --- Group Management APIs ---

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_list_create(request):
    """
    GET: List all groups where the user is a creator or member.
    POST: Create a new group and add the user as creator & member.
    """
    if request.method == 'GET':
        # Retrieve groups where request.user is creator OR member
        groups = Group.objects.filter(
            models.Q(created_by=request.user) | models.Q(members=request.user)
        ).distinct().order_by('-created_at')
        serializer = GroupSerializer(groups, many=True, context={'request': request})
        return Response(serializer.data)
        
    elif request.method == 'POST':
        serializer = GroupSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            group = serializer.save(created_by=request.user)
            group.members.add(request.user)
            # Optionally auto-create a member profile for the creator in the group members
            Member.objects.get_or_create(
                group=group,
                name=request.user.username,
                defaults={
                    'email': request.user.email,
                    'user': request.user
                }
            )
            return Response(GroupSerializer(group, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def group_detail_update_delete(request, pk):
    """
    Retrieve, update, or delete a group.
    """
    group = get_group_for_user(request.user, pk, require_creator=(request.method != 'GET'))
    
    if request.method == 'GET':
        return Response(GroupSerializer(group, context={'request': request}).data)
        
    elif request.method in ['PUT', 'PATCH']:
        partial = (request.method == 'PATCH')
        serializer = GroupSerializer(group, data=request.data, partial=partial, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(GroupSerializer(group, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    elif request.method == 'DELETE':
        group.delete()
        return Response({'detail': 'Group deleted successfully.'}, status=status.HTTP_200_OK)


# --- Member Management APIs ---

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def member_list_create(request, group_pk):
    """
    GET: List all members of a group.
    POST: Add a member to a group. Requires group creator.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=(request.method == 'POST'))
    
    if request.method == 'GET':
        members = group.group_members.all().order_by('name')
        serializer = MemberSerializer(members, many=True)
        return Response(serializer.data)
        
    elif request.method == 'POST':
        serializer = MemberSerializer(data=request.data, context={'group': group})
        if serializer.is_valid():
            member = serializer.save(group=group)
            return Response(MemberSerializer(member).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def member_detail_update_delete(request, group_pk, pk):
    """
    Update or delete a group member.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=False)
    member = get_object_or_404(Member, pk=pk, group=group)
    
    is_owner = (group.created_by == request.user)
    
    # Check if target member is the group owner
    target_is_owner = (member.user == group.created_by) or (
        member.user is None and group.created_by and member.email.strip().lower() == group.created_by.email.strip().lower()
    )
    
    # Check if target member is the request.user
    target_is_self = (member.user == request.user) or (
        member.user is None and member.email.strip().lower() == request.user.email.strip().lower()
    )
    
    if request.method in ['PUT', 'PATCH']:
        if not is_owner:
            if not target_is_self:
                return Response({'detail': 'You do not have permission to edit other members.'}, status=status.HTTP_403_FORBIDDEN)
            if target_is_owner:
                return Response({'detail': 'You cannot edit the group owner.'}, status=status.HTTP_403_FORBIDDEN)
            
            # Normal members cannot update permission flags
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            data.pop('can_add_expense', None)
            data.pop('can_edit_expense', None)
            data.pop('can_delete_expense', None)
        else:
            data = request.data
            
        partial = (request.method == 'PATCH')
        serializer = MemberSerializer(member, data=data, partial=partial, context={'group': group})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    elif request.method == 'DELETE':
        if not is_owner:
            return Response({'detail': 'You do not have permission to delete members.'}, status=status.HTTP_403_FORBIDDEN)
            
        if target_is_owner:
            return Response({'detail': 'The group owner cannot be deleted.'}, status=status.HTTP_400_BAD_REQUEST)
            
        member_name = member.name
        member.delete()
        return Response({'detail': f"Member '{member_name}' removed successfully."}, status=status.HTTP_200_OK)


# --- Expense Management APIs ---

def create_equal_splits(expense, group):
    """
    Calculates and saves default equal splits for all current group members.
    """
    members = list(group.group_members.all())
    if not members:
        return
    total_amount = Decimal(str(expense.amount))
    n = len(members)
    base_share = (total_amount / n).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    total_splits = base_share * n
    remainder = total_amount - total_splits
    remainder_cents = int(remainder * 100)
    
    for i, m in enumerate(members):
        amount = base_share
        if i < remainder_cents:
            amount += Decimal('0.01')
        ExpenseSplit.objects.create(
            expense=expense,
            member=m,
            amount=amount
        )

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def expense_list_create(request, group_pk):
    """
    GET: List all expenses inside a group with the total sum.
    POST: Create a new expense. Requires group creator or member with can_add_expense permission.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=False)
    
    if request.method == 'GET':
        expenses = group.expenses.all().order_by('-date', '-created_at')
        serializer = ExpenseSerializer(expenses, many=True)
        total_amount = sum(expense.amount for expense in expenses)
        return Response({
            'expenses': serializer.data,
            'total_amount': total_amount
        })
        
    elif request.method == 'POST':
        # Check permissions
        is_creator = (group.created_by == request.user)
        member = group.group_members.filter(
            models.Q(user=request.user) | models.Q(email__iexact=request.user.email)
        ).first()
        
        if member:
            if not member.user:
                member.user = request.user
                member.save()
        elif is_creator:
            member, _ = Member.objects.get_or_create(
                group=group,
                user=request.user,
                defaults={
                    'name': request.user.username,
                    'email': request.user.email
                }
            )
        
        if not is_creator and (not member or not member.can_add_expense):
            return Response({'detail': 'You do not have permission to add expenses to this group.'}, status=status.HTTP_403_FORBIDDEN)
            
        if not member:
            return Response({'detail': 'You must be a member of this group to add expenses.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not group.group_members.exists():
            return Response({'detail': 'Please add at least one member to the group before adding expenses.'}, status=status.HTTP_400_BAD_REQUEST)
            
        serializer = ExpenseSerializer(data=request.data)
        if serializer.is_valid():
            expense = serializer.save(group=group, created_by=request.user, paid_by=member)
            # Create default equal splits for all current group members
            create_equal_splits(expense, group)
            # Recalculate group settlements to sync the balances
            recalculate_group_settlements(group)
            return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def expense_detail_update_delete(request, group_pk, pk):
    """
    Retrieve details of an expense (including split info), update, or delete it.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=False)
    expense = get_object_or_404(Expense, pk=pk, group=group)
    
    if request.method == 'GET':
        expense_data = ExpenseSerializer(expense).data
        splits = expense.splits.all().order_by('member__name')
        splits_data = ExpenseSplitSerializer(splits, many=True).data
        expense_data['splits'] = splits_data
        return Response(expense_data)
        
    elif request.method in ['PUT', 'PATCH']:
        # Check permissions
        is_creator = (group.created_by == request.user)
        member = group.group_members.filter(user=request.user).first()
        
        if not is_creator and (not member or not member.can_edit_expense):
            return Response({'detail': 'You do not have permission to edit expenses in this group.'}, status=status.HTTP_403_FORBIDDEN)
            
        old_amount = expense.amount
        partial = (request.method == 'PATCH')
        serializer = ExpenseSerializer(expense, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            
            # If amount changed, scale existing splits proportionally
            new_amount = serializer.validated_data.get('amount')
            if new_amount is not None and Decimal(str(new_amount)) != Decimal(str(old_amount)):
                new_total = Decimal(str(new_amount))
                splits = list(expense.splits.all())
                if splits:
                    total_splits_amount = sum(s.amount for s in splits)
                    if total_splits_amount > 0:
                        ratio = new_total / total_splits_amount
                        accumulated = Decimal('0.00')
                        for i, s in enumerate(splits):
                            if i < len(splits) - 1:
                                s.amount = (s.amount * ratio).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
                                accumulated += s.amount
                            else:
                                s.amount = new_total - accumulated
                            s.save()
                    else:
                        # Re-create equal splits if old sum was 0
                        ExpenseSplit.objects.filter(expense=expense).delete()
                        create_equal_splits(expense, group)
                else:
                    create_equal_splits(expense, group)
            
            # Recalculate group settlements
            recalculate_group_settlements(group)
            
            # Re-fetch expense with its updated splits to return full details
            return Response(ExpenseSerializer(expense).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    elif request.method == 'DELETE':
        # Check permissions
        is_creator = (group.created_by == request.user)
        member = group.group_members.filter(user=request.user).first()
        
        if not is_creator and (not member or not member.can_delete_expense):
            return Response({'detail': 'You do not have permission to delete expenses in this group.'}, status=status.HTTP_403_FORBIDDEN)
            
        expense.delete()
        # Recalculate group settlements
        recalculate_group_settlements(group)
        return Response({'detail': 'Expense deleted successfully.'}, status=status.HTTP_200_OK)


# --- Expense Splitting APIs ---

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preview_equal_split(request, group_pk, expense_pk):
    """
    Given a list of member IDs in request.data['member_ids'], calculate the equal splits without saving.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=False)
    expense = get_object_or_404(Expense, pk=expense_pk, group=group)
    
    if expense.created_by != request.user:
        raise PermissionDenied("Only the expense creator can perform this action.")
    
    selected_ids = request.data.get('member_ids', [])
    if not selected_ids:
        return Response({'detail': 'Please select at least one member.'}, status=status.HTTP_400_BAD_REQUEST)
        
    selected_members = list(Member.objects.filter(id__in=selected_ids, group=group).order_by('name'))
    if len(selected_members) != len(selected_ids):
        return Response({'detail': 'Invalid members provided.'}, status=status.HTTP_400_BAD_REQUEST)
        
    total_amount = Decimal(str(expense.amount))
    n = len(selected_members)
    
    base_share = (total_amount / n).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    total_splits = base_share * n
    remainder = total_amount - total_splits
    remainder_cents = int(remainder * 100)
    
    splits_preview = []
    for i, m in enumerate(selected_members):
        amount = base_share
        if i < remainder_cents:
            amount += Decimal('0.01')
        splits_preview.append({
            'member_id': m.id,
            'member_name': m.name,
            'amount': amount
        })
        
    return Response(splits_preview)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_expense_splits(request, group_pk, expense_pk):
    """
    Save splits for an expense.
    Request body:
    {
      "split_method": "equal" | "unequal",
      "splits": [{"member_id": 1, "amount": 30.00}, ...]
    }
    """
    group = get_group_for_user(request.user, group_pk, require_creator=False)
    expense = get_object_or_404(Expense, pk=expense_pk, group=group)
    
    if expense.created_by != request.user:
        raise PermissionDenied("Only the expense creator can perform this action.")
    
    split_method = request.data.get('split_method')
    splits_input = request.data.get('splits', [])
    
    if not split_method or split_method not in ['equal', 'unequal']:
        return Response({'detail': 'Invalid or missing split method.'}, status=status.HTTP_400_BAD_REQUEST)
        
    if not splits_input:
        return Response({'detail': 'Please provide splits details.'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Verify all members in splits belong to the group
    member_ids = [s.get('member_id') for s in splits_input]
    db_members = list(Member.objects.filter(id__in=member_ids, group=group))
    if len(db_members) != len(member_ids):
        return Response({'detail': 'Some members do not belong to this group.'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Validation rules:
    total_expense = Decimal(str(expense.amount))
    total_entered = Decimal('0.00')
    entered_shares = {}
    
    for s in splits_input:
        m_id = s.get('member_id')
        try:
            val = Decimal(str(s.get('amount', '0.00')))
            if val < 0:
                return Response({'detail': 'Split amounts cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)
            if val > total_expense:
                return Response({'detail': 'Split amount cannot exceed total expense.'}, status=status.HTTP_400_BAD_REQUEST)
            entered_shares[m_id] = val
            total_entered += val
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid split amount entered.'}, status=status.HTTP_400_BAD_REQUEST)
            
    # Verify total sum of splits equals expense amount
    diff = abs(total_expense - total_entered)
    if diff >= Decimal('0.01'):
        return Response({
            'detail': f"Total split amounts (₹{total_entered:.2f}) must exactly equal total expense (₹{total_expense:.2f}). Diff: ₹{(total_expense - total_entered):.2f}"
        }, status=status.HTTP_400_BAD_REQUEST)
        
    # 1. Clear old splits
    ExpenseSplit.objects.filter(expense=expense).delete()
    
    # 2. Save splits: members in input get calculated/entered shares, other group members get 0.00
    all_group_members = group.group_members.all()
    created_splits = []
    for m in all_group_members:
        share_amount = entered_shares.get(m.id, Decimal('0.00'))
        split = ExpenseSplit.objects.create(
            expense=expense,
            member=m,
            amount=share_amount
        )
        created_splits.append(split)
        
    # Recalculate settlements
    recalculate_group_settlements(group)
    
    serializer = ExpenseSplitSerializer(created_splits, many=True)
    return Response({
        'detail': 'Splits saved successfully.',
        'splits': serializer.data
    }, status=status.HTTP_200_OK)


# --- Balances & Settlements APIs ---

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_balances(request, group_pk):
    """
    GET: Calculate balances and return active member net balances and recommended smart settlements.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=False)
    
    # Calculate balances and sync recommended settlements
    member_balances = recalculate_group_settlements(group)
    
    # Format response: serialize member objects inside balances
    formatted_balances = []
    for b in member_balances:
        formatted_balances.append({
            'member': MemberSerializer(b['member']).data,
            'paid': b['paid'],
            'owes': b['owes'],
            'receivable': b['receivable'],
            'net_balance': b['net_balance']
        })
        
    # Get active pending settlements
    pending_settlements = group.settlements.filter(status='pending').order_by('payer__name')
    pending_data = SettlementSerializer(pending_settlements, many=True).data
    
    return Response({
        'balances': formatted_balances,
        'recommended_settlements': pending_data
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def member_ledger(request, group_pk, member_pk):
    """
    GET: Get detailed transaction history for a single group member.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=False)
    member = get_object_or_404(Member, pk=member_pk, group=group)
    
    # Recalculate balances
    all_balances = recalculate_group_settlements(group)
    member_summary = None
    for b in all_balances:
        if b['member'].id == member.id:
            member_summary = {
                'paid': b['paid'],
                'owes': b['owes'],
                'receivable': b['receivable'],
                'net_balance': b['net_balance']
            }
            break
            
    # Fetch data
    expenses_paid = Expense.objects.filter(group=group, paid_by=member).order_by('-date')
    splits_owed = ExpenseSplit.objects.filter(expense__group=group, member=member).order_by('-expense__date')
    settlements_sent = Settlement.objects.filter(group=group, payer=member).order_by('-date')
    settlements_received = Settlement.objects.filter(group=group, payee=member).order_by('-date')
    
    # Format response
    return Response({
        'member': MemberSerializer(member).data,
        'summary': member_summary,
        'expenses_paid': ExpenseSerializer(expenses_paid, many=True).data,
        'splits_owed': ExpenseSplitSerializer(splits_owed, many=True).data,
        'settlements_sent': SettlementSerializer(settlements_sent, many=True).data,
        'settlements_received': SettlementSerializer(settlements_received, many=True).data,
    })

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def settlement_list_create(request, group_pk):
    """
    GET: List all settlements of a group (filter by status completed/pending).
    POST: Record a manual settlement. Requires group creator.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=(request.method == 'POST'))
    
    # Recalculate to make sure pending recommendations are up to date
    recalculate_group_settlements(group)
    
    if request.method == 'GET':
        status_filter = request.query_params.get('status', 'all')
        settlements = group.settlements.all().order_by('-date')
        
        if status_filter == 'completed':
            settlements = settlements.filter(status='completed')
        elif status_filter == 'pending':
            settlements = settlements.filter(status='pending')
            
        serializer = SettlementSerializer(settlements, many=True)
        return Response(serializer.data)
        
    elif request.method == 'POST':
        serializer = SettlementSerializer(data=request.data, context={'group': group})
        if serializer.is_valid():
            # Validate payer and payee belong to the group
            payer = serializer.validated_data.get('payer')
            payee = serializer.validated_data.get('payee')
            if payer.group != group or payee.group != group:
                return Response({'detail': 'Payer and payee must belong to the group.'}, status=status.HTTP_400_BAD_REQUEST)
                
            settlement = serializer.save(group=group)
            return Response(SettlementSerializer(settlement).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_settlement(request, group_pk, pk):
    """
    POST: Mark a pending settlement as completed.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=True)
    settlement = get_object_or_404(Settlement, pk=pk, group=group)
    
    if settlement.status == 'completed':
        return Response({'detail': 'This settlement is already completed.'}, status=status.HTTP_400_BAD_REQUEST)
        
    settlement.status = 'completed'
    settlement.save()
    return Response({
        'detail': 'Settlement marked as completed.',
        'settlement': SettlementSerializer(settlement).data
    }, status=status.HTTP_200_OK)


# --- Budget Configuration APIs ---

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_budget(request, group_pk):
    """
    GET: Retrieve the group budget limit and the total group spending (to compare/alert).
    POST: Set or update the budget limit. Requires group creator.
    """
    group = get_group_for_user(request.user, group_pk, require_creator=(request.method == 'POST'))
    budget = Budget.objects.filter(group=group).first()
    
    if request.method == 'GET':
        budget_data = BudgetSerializer(budget).data if budget else None
        
        # Calculate sum total of expenses in the group
        expenses = group.expenses.all()
        total_spending = sum(expense.amount for expense in expenses)
        
        is_exceeded = False
        if budget and total_spending > budget.amount_limit:
            is_exceeded = True
            
        return Response({
            'budget': budget_data,
            'total_spending': total_spending,
            'is_exceeded': is_exceeded
        })
        
    elif request.method == 'POST':
        limit = request.data.get('amount_limit')
        if limit is None or Decimal(str(limit)) <= 0:
            return Response({'amount_limit': 'Amount limit must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if budget:
            budget.amount_limit = Decimal(str(limit))
            budget.save()
        else:
            budget = Budget.objects.create(group=group, amount_limit=Decimal(str(limit)))
            
        return Response(BudgetSerializer(budget).data, status=status.HTTP_200_OK)


def send_invitation_email(invitation, request=None):
    """
    Sends an invitation email containing a link to accept/view the invitation.
    """
    invite_url = f"http://localhost:5173/invitations/{invitation.id}"
    subject = f"You've been invited to join {invitation.group.name} on Smart Splitter"
    
    plain_message = (
        f"Hi there!\n\n"
        f"{invitation.invited_by.username} has invited you to join the expense group \"{invitation.group.name}\" on Smart Splitter.\n\n"
        f"Click the link below to accept the invitation and start tracking group expenses:\n"
        f"{invite_url}\n\n"
        f"If you don't have an account yet, you can quickly sign up and join automatically!\n\n"
        f"Best regards,\n"
        f"Smart Splitter Team"
    )
    
    description_section = ""
    if invitation.group.description:
        description_section = f"""
        <tr>
            <td style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Description</td>
        </tr>
        <tr>
            <td style="font-size: 14px; color: #d1d5db; line-height: 1.5; padding-bottom: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">{invitation.group.description}</td>
        </tr>
        """
        
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've been invited to join {invitation.group.name}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid #1f2937; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
                        
                        <!-- Top Accent Banner -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); height: 6px; background-color: #6366f1;"></td>
                        </tr>
                        
                        <!-- Main Card Body -->
                        <tr>
                            <td style="padding: 40px 32px;">
                                
                                <!-- Brand Logo -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                                    <tr>
                                        <td>
                                            <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                                                <span style="color: #6366f1;">Smart</span>Splitter
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Welcome / Headline -->
                                <h1 style="margin: 0 0 16px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.25; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    You're invited!
                                </h1>
                                
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #d1d5db; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    Hi there,
                                </p>
                                
                                <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #d1d5db; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    <strong style="color: #ffffff;">{invitation.invited_by.username}</strong> has invited you to join the expense sharing group <strong style="color: #818cf8; font-size: 17px;">"{invitation.group.name}"</strong> on Smart Splitter.
                                </p>
                                
                                <!-- Group Details Panel -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1f2937; border-radius: 16px; margin-bottom: 32px; border: 1px solid #374151;">
                                    <tr>
                                        <td style="padding: 20px;">
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr>
                                                    <td style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Group Name</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size: 16px; font-weight: 700; color: #ffffff; padding-bottom: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">{invitation.group.name}</td>
                                                </tr>
                                                {description_section}
                                                <tr>
                                                    <td style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">What you can do</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size: 13px; color: #d1d5db; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                        • View and split shared bills dynamically<br>
                                                        • Track who owes what with automated balances<br>
                                                        • Record custom settlements and manage budgets
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- CTA Button -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                                    <tr>
                                        <td align="center">
                                            <a href="{invite_url}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; background-image: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 12px; text-align: center; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3); border: 1px solid #4f46e5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                                Accept Invitation & Join Group
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Alternative Link & Subtext -->
                                <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.5; color: #9ca3af; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    Don't have an account yet? Creating one is free and takes just a moment.
                                </p>
                                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    If the button doesn't work, copy and paste this URL into your browser:<br>
                                    <a href="{invite_url}" style="color: #6366f1; text-decoration: none; word-break: break-all;">{invite_url}</a>
                                </p>
                                
                            </td>
                        </tr>
                        
                        <!-- Card Footer -->
                        <tr>
                            <td style="padding: 24px 32px; background-color: #1f2937; border-top: 1px solid #374151; text-align: center;">
                                <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    Sent by <strong style="color: #ffffff;">Smart Splitter</strong> Expense Management App
                                </p>
                                <p style="margin: 0; font-size: 11px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    You received this email because you were invited to a shared expense group.
                                </p>
                            </td>
                        </tr>
                        
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@smartsplitter.com'),
            recipient_list=[invitation.email],
            html_message=html_message,
            fail_silently=False
        )
        return True
    except Exception as e:
        print(f"Error sending invitation email: {e}")
        return False

# --- Group Invitation APIs ---

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_member(request, group_pk):
    """
    POST: Invite a member by email to join the group.
    Allowed for group creator or any existing member of the group.
    """
    group = get_object_or_404(Group, pk=group_pk)
    if request.user != group.created_by and not group.members.filter(pk=request.user.pk).exists():
        return Response({'detail': 'You do not have permission to invite members to this group.'}, status=status.HTTP_403_FORBIDDEN)
        
    email = request.data.get('email', '').strip()
    
    if not email:
        return Response({'email': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Check if this email is already a member of the group
    if group.group_members.filter(email__iexact=email).exists():
        return Response({'email': 'A user with this email is already a member of this group.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if an invitation already exists for this email
    invitation = Invitation.objects.filter(group=group, email__iexact=email).first()
    if invitation:
        if invitation.status == 'pending' and not invitation.is_expired:
            return Response({'email': ['An active invitation has already been sent to this email.']}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.utils import timezone
        invitation.status = 'pending'
        invitation.invited_by = request.user
        invitation.created_at = timezone.now()
        invitation.save()
        email_sent = send_invitation_email(invitation, request)
        if not email_sent:
            return Response({'detail': 'Failed to send invitation email. Please check your email configuration.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(InvitationSerializer(invitation).data, status=status.HTTP_200_OK)
        
    # Create new invitation
    invitation = Invitation.objects.create(
        group=group,
        email=email,
        invited_by=request.user,
        status='pending'
    )
    
    # Send email dispatch
    email_sent = send_invitation_email(invitation, request)
    if not email_sent:
        invitation.delete()
        return Response({'detail': 'Failed to send invitation email. Please check your email configuration.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response(InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_group_invitations(request, group_pk):
    """
    GET: List all invitations sent for a specific group.
    """
    group = get_object_or_404(Group, pk=group_pk)
    if request.user != group.created_by and not group.members.filter(pk=request.user.pk).exists():
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
    invitations = Invitation.objects.filter(group=group).order_by('-created_at')
    serializer = InvitationSerializer(invitations, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_invitation_detail(request, pk):
    """
    GET: Fetch details of a specific invitation by ID.
    Supports both authenticated and unauthenticated callers.
    """
    invitation = get_object_or_404(Invitation, pk=pk)
    if invitation.is_expired:
        return Response({'detail': 'This invitation link has expired.'}, status=status.HTTP_400_BAD_REQUEST)
        
    group = invitation.group
    
    is_already_member = False
    if request.user and request.user.is_authenticated:
        is_already_member = group.members.filter(pk=request.user.pk).exists()
        
    return Response({
        'id': invitation.id,
        'group_id': group.id,
        'group_name': group.name,
        'group_description': group.description,
        'invited_by_username': invitation.invited_by.username,
        'invited_by_email': invitation.invited_by.email,
        'email': invitation.email,
        'status': invitation.status,
        'created_at': invitation.created_at,
        'member_count': group.members.count(),
        'is_already_member': is_already_member
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_pending_invitations(request):
    """
    GET: List all pending invitations for the current user.
    """
    from django.utils import timezone
    from datetime import timedelta
    expiry_limit = timezone.now() - timedelta(hours=24)
    invitations = Invitation.objects.filter(
        email__iexact=request.user.email,
        status='pending',
        created_at__gte=expiry_limit
    ).order_by('-created_at')
    
    serializer = InvitationSerializer(invitations, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invitation(request, pk):
    """
    POST: Accept a pending group invitation.
    """
    invitation = get_object_or_404(Invitation, pk=pk)
    if invitation.is_expired:
        return Response({'detail': 'This invitation link has expired.'}, status=status.HTTP_400_BAD_REQUEST)
        
    if invitation.status == 'accepted':
        return Response({'detail': 'Invitation already accepted.', 'group_id': invitation.group.id}, status=status.HTTP_200_OK)
        
    group = invitation.group
    
    # Add user to the group ManyToMany members list
    group.members.add(request.user)
    
    # Mark invitation as accepted
    invitation.status = 'accepted'
    invitation.save()
    
    # Check if a Member profile with this email or user already exists in this group.
    member = Member.objects.filter(group=group).filter(
        models.Q(user=request.user) | models.Q(email__iexact=request.user.email)
    ).first()
    
    if member:
        member.user = request.user
        if not member.email and request.user.email:
            member.email = request.user.email
        member.save()
    else:
        # Create a new Member profile for this user in the group
        Member.objects.create(
            group=group,
            user=request.user,
            name=request.user.username,
            email=request.user.email
        )
        
    return Response({
        'detail': f'Joined group {group.name} successfully.',
        'group_id': group.id
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_invitation(request, pk):
    """
    POST: Decline a pending group invitation.
    """
    invitation = get_object_or_404(Invitation, pk=pk)
    if invitation.is_expired:
        return Response({'detail': 'This invitation link has expired.'}, status=status.HTTP_400_BAD_REQUEST)
        
    invitation.status = 'declined'
    invitation.save()
    return Response({'detail': 'Invitation declined successfully.'}, status=status.HTTP_200_OK)

