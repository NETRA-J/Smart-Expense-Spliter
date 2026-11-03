import json
from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from .models import Group, Expense, ExpenseSplit, Settlement, Budget, Member, Invitation

class ModelTests(TestCase):
    def setUp(self):
        # Create test users
        self.user1 = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.user2 = User.objects.create_user(username='bob', email='bob@example.com', password='password123')
        self.user3 = User.objects.create_user(username='charlie', email='charlie@example.com', password='password123')

        # Create a test group
        self.group = Group.objects.create(
            name='Trip to Goa',
            description='Vacation expenses',
            created_by=self.user1
        )
        self.group.members.add(self.user1, self.user2, self.user3)

        # Create members for paid_by checks and splits
        self.member1 = Member.objects.create(
            group=self.group,
            name='Alice Member',
            email='alice@example.com'
        )
        self.member2 = Member.objects.create(
            group=self.group,
            name='Bob Member',
            email='bob@example.com'
        )
        self.member3 = Member.objects.create(
            group=self.group,
            name='Charlie Member',
            email='charlie@example.com'
        )

    def test_group_creation(self):
        self.assertEqual(self.group.name, 'Trip to Goa')
        self.assertEqual(self.group.members.count(), 3)
        self.assertEqual(str(self.group), 'Trip to Goa')

    def test_expense_creation(self):
        expense = Expense.objects.create(
            group=self.group,
            title='Dinner bill',
            amount=90.00,
            paid_by=self.member1,
            date=date.today(),
            category='Food',
            created_by=self.user1
        )
        self.assertEqual(expense.title, 'Dinner bill')
        self.assertEqual(expense.amount, 90.00)
        self.assertEqual(str(expense), f"Dinner bill - 90.00 in Trip to Goa")

    def test_expense_split(self):
        expense = Expense.objects.create(
            group=self.group,
            title='Dinner bill',
            amount=90.00,
            paid_by=self.member1,
            date=date.today(),
            category='Food',
            created_by=self.user1
        )
        # Create splits
        split1 = ExpenseSplit.objects.create(expense=expense, member=self.member1, amount=30.00)
        split2 = ExpenseSplit.objects.create(expense=expense, member=self.member2, amount=30.00)
        split3 = ExpenseSplit.objects.create(expense=expense, member=self.member3, amount=30.00)

        self.assertEqual(expense.splits.count(), 3)
        self.assertEqual(split1.amount, 30.00)
        self.assertEqual(str(split1), "Alice Member owes 30.00 for Dinner bill")

        # Test unique_together constraint on (expense, member)
        with self.assertRaises(IntegrityError):
            ExpenseSplit.objects.create(expense=expense, member=self.member1, amount=10.00)

    def test_settlement(self):
        settlement = Settlement.objects.create(
            group=self.group,
            payer=self.member2,
            payee=self.member1,
            amount=30.00,
            status='completed'
        )
        self.assertEqual(settlement.payer, self.member2)
        self.assertEqual(settlement.payee, self.member1)
        self.assertEqual(settlement.amount, 30.00)
        self.assertEqual(settlement.status, 'completed')
        self.assertEqual(str(settlement), "Bob Member paid Alice Member 30.00 in Trip to Goa")

    def test_budget_creation(self):
        # Create group budget
        group_budget = Budget.objects.create(
            group=self.group,
            amount_limit=500.00
        )
        self.assertEqual(group_budget.amount_limit, 500.00)
        self.assertEqual(str(group_budget), "Budget of 500.00 for group Trip to Goa")

        # Create personal budget
        user_budget = Budget.objects.create(
            user=self.user1,
            amount_limit=100.00
        )
        self.assertEqual(user_budget.amount_limit, 100.00)
        self.assertEqual(str(user_budget), "Personal budget of 100.00 for alice")


class AuthenticationAPITests(APITestCase):
    def setUp(self):
        self.username = 'testuser'
        self.email = 'testuser@example.com'
        self.password = 'SecurePassword123'
        self.user = User.objects.create_user(username=self.username, email=self.email, password=self.password)
        
        self.login_url = reverse('api_login')
        self.register_url = reverse('api_register')
        self.logout_url = reverse('api_logout')
        self.me_url = reverse('api_me')

    def test_registration_successful(self):
        payload = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'Password999',
            'confirm_password': 'Password999'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_registration_mismatched_passwords(self):
        payload = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'Password999',
            'confirm_password': 'DifferentPassword'
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_successful(self):
        payload = {
            'username': self.username,
            'password': self.password
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)

    def test_login_invalid_credentials(self):
        payload = {
            'username': self.username,
            'password': 'WrongPassword123'
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Invalid username or password.')

    def test_me_requires_login(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_accessible_when_logged_in(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], self.username)

    def test_logout_successful(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        response = self.client.post(self.logout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(key=token.key).exists())


class GroupAPICRUDTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.user2 = User.objects.create_user(username='bob', email='bob@example.com', password='password123')
        
        self.token1, _ = Token.objects.get_or_create(user=self.user1)
        self.token2, _ = Token.objects.get_or_create(user=self.user2)
        
        self.list_create_url = reverse('api_group_list_create')
        self.group = Group.objects.create(name='Trip to Goa', created_by=self.user1)
        self.group.members.add(self.user1)
        self.detail_url = reverse('api_group_detail_update_delete', kwargs={'pk': self.group.pk})

    def test_group_pages_require_login(self):
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_group_list_shows_correct_groups(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Trip to Goa')

    def test_group_create_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)
        payload = {'name': 'New Group', 'description': 'Some description'}
        response = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'New Group')
        self.assertTrue(Group.objects.filter(name='New Group', created_by=self.user2).exists())

    def test_group_update_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {'name': 'Updated Goa Trip'}
        response = self.client.patch(self.detail_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.group.refresh_from_db()
        self.assertEqual(self.group.name, 'Updated Goa Trip')

    def test_group_update_unauthorized(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)
        payload = {'name': 'Hacked Group'}
        response = self.client.patch(self.detail_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_group_delete_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Group.objects.filter(pk=self.group.pk).exists())


class MemberAPICRUDTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.user2 = User.objects.create_user(username='bob', email='bob@example.com', password='password123')
        
        self.token1, _ = Token.objects.get_or_create(user=self.user1)
        self.token2, _ = Token.objects.get_or_create(user=self.user2)
        
        self.group = Group.objects.create(name='Trip to Goa', created_by=self.user1)
        self.group.members.add(self.user1)
        self.group.members.add(self.user2)
        
        self.owner_member = Member.objects.create(group=self.group, name='Alice Member', email='alice@example.com', user=self.user1)
        self.member = Member.objects.create(group=self.group, name='Bob Member', email='bob@example.com', user=self.user2)
        
        self.list_create_url = reverse('api_member_list_create', kwargs={'group_pk': self.group.pk})
        self.detail_url = reverse('api_member_detail_update_delete', kwargs={'group_pk': self.group.pk, 'pk': self.member.pk})

    def test_member_list_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should contain the creator member auto-profile + Bob Member
        self.assertTrue(len(response.data) >= 1)

    def test_member_create_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {'name': 'Charlie Member', 'email': 'charlie@example.com'}
        response = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Charlie Member')

    def test_member_create_duplicate_validation(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {'name': 'Bob Member', 'email': 'anotherbob@example.com'}
        response = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_member_update_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {'name': 'Bobby Member'}
        response = self.client.patch(self.detail_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.name, 'Bobby Member')

    def test_member_delete_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Member.objects.filter(pk=self.member.pk).exists())

    def test_normal_member_edit_self_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)
        payload = {'name': 'Bob Edited'}
        response = self.client.patch(self.detail_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.name, 'Bob Edited')

    def test_normal_member_edit_permissions_ignored(self):
        # Even if they try to escalate permissions, it should be ignored
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)
        payload = {'can_delete_expense': True, 'can_edit_expense': True}
        response = self.client.patch(self.detail_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertFalse(self.member.can_delete_expense)
        self.assertFalse(self.member.can_edit_expense)

    def test_normal_member_edit_owner_forbidden(self):
        owner_detail_url = reverse('api_member_detail_update_delete', kwargs={'group_pk': self.group.pk, 'pk': self.owner_member.pk})
        
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)
        payload = {'name': 'Alice Edited'}
        response = self.client.patch(owner_detail_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_normal_member_edit_other_member_forbidden(self):
        # Create another normal member (Charlie)
        charlie_member = Member.objects.create(group=self.group, name='Charlie Member', email='charlie@example.com')
        charlie_detail_url = reverse('api_member_detail_update_delete', kwargs={'group_pk': self.group.pk, 'pk': charlie_member.pk})
        
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)
        payload = {'name': 'Charlie Edited'}
        response = self.client.patch(charlie_detail_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_normal_member_delete_forbidden(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token2.key)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ExpenseAPICRUDTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.token1, _ = Token.objects.get_or_create(user=self.user1)
        
        self.group = Group.objects.create(name='Trip to Goa', created_by=self.user1)
        self.group.members.add(self.user1)
        
        self.member1 = Member.objects.create(group=self.group, name='Alice Member', email='alice@example.com')
        self.member2 = Member.objects.create(group=self.group, name='Bob Member', email='bob@example.com')
        
        self.expense = Expense.objects.create(
            group=self.group,
            title='Dinner bill',
            amount=100.00,
            paid_by=self.member1,
            date=date.today(),
            created_by=self.user1
        )
        
        self.list_create_url = reverse('api_expense_list_create', kwargs={'group_pk': self.group.pk})
        self.detail_url = reverse('api_expense_detail_update_delete', kwargs={'group_pk': self.group.pk, 'pk': self.expense.pk})

    def test_expense_list_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['expenses']), 1)

    def test_expense_create_success(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {
            'title': 'Taxi fare',
            'amount': '50.00',
            'date': str(date.today()),
            'category': 'Transport'
        }
        response = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Taxi fare')
        
        # Verify splits were automatically created
        expense_id = response.data['id']
        expense = Expense.objects.get(id=expense_id)
        self.assertEqual(expense.paid_by, self.member1)  # The payer is automatically self.member1 (Alice)
        self.assertEqual(expense.splits.count(), 2)
        for split in expense.splits.all():
            self.assertEqual(split.amount, Decimal('25.00'))

    def test_expense_update_proportional_scaling(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        
        # Save custom splits on the existing expense (amount = 100.00)
        # member1 gets 40.00, member2 gets 60.00
        save_url = reverse('api_save_expense_splits', kwargs={'group_pk': self.group.pk, 'expense_pk': self.expense.pk})
        split_payload = {
            'split_method': 'unequal',
            'splits': [
                {'member_id': self.member1.id, 'amount': '40.00'},
                {'member_id': self.member2.id, 'amount': '60.00'}
            ]
        }
        self.client.post(save_url, split_payload, format='json')
        
        # Update expense amount to 200.00
        update_payload = {'amount': '200.00'}
        response = self.client.patch(self.detail_url, update_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify splits scaled proportionally (member1 gets 80.00, member2 gets 120.00)
        self.expense.refresh_from_db()
        split1 = self.expense.splits.get(member=self.member1)
        split2 = self.expense.splits.get(member=self.member2)
        self.assertEqual(split1.amount, Decimal('80.00'))
        self.assertEqual(split2.amount, Decimal('120.00'))

    def test_expense_create_invalid_amount(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {
            'title': 'Free entry',
            'amount': '0.00',
            'date': str(date.today()),
            'category': 'Entertainment'
        }
        response = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ExpenseSplitAPITests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.token1, _ = Token.objects.get_or_create(user=self.user1)
        
        self.group = Group.objects.create(name='Trip to Goa', created_by=self.user1)
        self.group.members.add(self.user1)
        
        self.member1 = Member.objects.create(group=self.group, name='Alice Member', email='alice@example.com')
        self.member2 = Member.objects.create(group=self.group, name='Bob Member', email='bob@example.com')
        
        self.expense = Expense.objects.create(
            group=self.group,
            title='Dinner bill',
            amount=90.00,
            paid_by=self.member1,
            date=date.today(),
            created_by=self.user1
        )
        
        self.preview_url = reverse('api_preview_equal_split', kwargs={'group_pk': self.group.pk, 'expense_pk': self.expense.pk})
        self.save_url = reverse('api_save_expense_splits', kwargs={'group_pk': self.group.pk, 'expense_pk': self.expense.pk})

    def test_equal_split_preview_calculation(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {
            'member_ids': [self.member1.id, self.member2.id]
        }
        response = self.client.post(self.preview_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 90.00 / 2 members = 45.00
        self.assertEqual(response.data[0]['amount'], Decimal('45.00'))

    def test_save_expense_splits(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {
            'split_method': 'equal',
            'splits': [
                {'member_id': self.member1.id, 'amount': '30.00'},
                {'member_id': self.member2.id, 'amount': '60.00'}
            ]
        }
        response = self.client.post(self.save_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.expense.splits.count(), 2)

    def test_invited_member_expense_split_permissions(self):
        # Setup second user as an invited member of the group
        user2 = User.objects.create_user(username='bob', email='bob@example.com', password='password123')
        token2, _ = Token.objects.get_or_create(user=user2)
        self.group.members.add(user2)
        self.member2.user = user2
        self.member2.save()
        
        # Create an expense created by Bob
        expense_by_bob = Expense.objects.create(
            group=self.group,
            title='Bob lunch',
            amount=Decimal('60.00'),
            paid_by=self.member2,
            date=date.today(),
            created_by=user2
        )
        
        preview_url_bob = reverse('api_preview_equal_split', kwargs={'group_pk': self.group.pk, 'expense_pk': expense_by_bob.pk})
        save_url_bob = reverse('api_save_expense_splits', kwargs={'group_pk': self.group.pk, 'expense_pk': expense_by_bob.pk})
        
        # 1. Bob (invited group member and creator of the expense) can preview splits for his own expense
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token2.key)
        payload = {
            'member_ids': [self.member1.id, self.member2.id]
        }
        response = self.client.post(preview_url_bob, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 2. Bob can save splits for his own expense
        payload_save = {
            'split_method': 'equal',
            'splits': [
                {'member_id': self.member1.id, 'amount': '30.00'},
                {'member_id': self.member2.id, 'amount': '30.00'}
            ]
        }
        response = self.client.post(save_url_bob, payload_save, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(expense_by_bob.splits.count(), 2)
        
        # 3. Bob (invited group member, but NOT creator of Alice's expense) cannot preview splits for Alice's expense
        payload = {
            'member_ids': [self.member1.id, self.member2.id]
        }
        response = self.client.post(self.preview_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 4. Bob cannot save splits for Alice's expense
        payload_save = {
            'split_method': 'equal',
            'splits': [
                {'member_id': self.member1.id, 'amount': '45.00'},
                {'member_id': self.member2.id, 'amount': '45.00'}
            ]
        }
        response = self.client.post(self.save_url, payload_save, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SettlementAndBalanceAPITests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.token1, _ = Token.objects.get_or_create(user=self.user1)
        
        self.group = Group.objects.create(name='Trip to Goa', created_by=self.user1)
        self.group.members.add(self.user1)
        
        self.member1 = Member.objects.create(group=self.group, name='Alice Member', email='alice@example.com')
        self.member2 = Member.objects.create(group=self.group, name='Bob Member', email='bob@example.com')
        
        # Alice paid 90.00 for Dinner split equally
        self.expense = Expense.objects.create(
            group=self.group,
            title='Dinner bill',
            amount=90.00,
            paid_by=self.member1,
            date=date.today(),
            created_by=self.user1
        )
        ExpenseSplit.objects.create(expense=self.expense, member=self.member1, amount=45.00)
        ExpenseSplit.objects.create(expense=self.expense, member=self.member2, amount=45.00)
        
        self.balances_url = reverse('api_group_balances', kwargs={'group_pk': self.group.pk})
        self.settlement_url = reverse('api_settlement_list_create', kwargs={'group_pk': self.group.pk})

    def test_recalculate_group_settlements_correctness(self):
        from .views import recalculate_group_settlements
        balances = recalculate_group_settlements(self.group)
        # Alice should have net_balance of +45.00
        alice_bal = next(b for b in balances if b['member'].id == self.member1.id)
        self.assertEqual(alice_bal['net_balance'], Decimal('45.00'))
        
        # Bob should have net_balance of -45.00
        bob_bal = next(b for b in balances if b['member'].id == self.member2.id)
        self.assertEqual(bob_bal['net_balance'], Decimal('-45.00'))

    def test_balances_api(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        response = self.client.get(self.balances_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('balances', response.data)
        self.assertIn('recommended_settlements', response.data)

    def test_create_settlement_api(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token1.key)
        payload = {
            'payer': self.member2.id,
            'payee': self.member1.id,
            'amount': '45.00',
            'status': 'completed'
        }
        response = self.client.post(self.settlement_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'completed')


from django.core import mail

class InvitationEmailTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='inviter', email='inviter@example.com', password='password123')
        self.token = Token.objects.create(user=self.user)
        self.group = Group.objects.create(name='Vacation Group', created_by=self.user)
        self.group.members.add(self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)
        self.invite_url = reverse('api_invite_member', kwargs={'group_pk': self.group.pk})

    def test_invite_member_dispatches_email(self):
        mail.outbox = []
        payload = {'email': 'friend@example.com'}
        response = self.client.post(self.invite_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('You\'ve been invited to join Vacation Group', mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ['friend@example.com'])

    def test_invite_member_after_email_update(self):
        # 1. Register a user (invitee_user) with Email A (invitee@example.com)
        invitee_user = User.objects.create_user(
            username='invitee',
            email='invitee@example.com',
            password='password123'
        )
        # 2. Add them to group.members list (representing they accepted invitation or joined)
        self.group.members.add(invitee_user)

        # 3. Create their member record in the group with Email A
        member = Member.objects.create(
            group=self.group,
            user=invitee_user,
            name='Invitee Member',
            email='invitee@example.com'
        )

        # 4. Create an invitation row in the database with status 'accepted'
        Invitation.objects.create(
            group=self.group,
            email='invitee@example.com',
            invited_by=self.user,
            status='accepted'
        )

        # 5. Edit the member record's email from Email A to Email B
        member.email = 'invitee_new@example.com'
        member.save()

        # 6. Try inviting Email A again via the API
        mail.outbox = []
        payload = {'email': 'invitee@example.com'}
        response = self.client.post(self.invite_url, payload, format='json')
        
        # 7. Check that the invitation succeeded and returned HTTP_200_OK (since invitation existed)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(len(mail.outbox), 1)

    def test_invite_member_after_email_update_no_invitation(self):
        # 1. Register a user (invitee_user) with Email A (invitee@example.com)
        invitee_user = User.objects.create_user(
            username='invitee_no_inv',
            email='invitee_no_inv@example.com',
            password='password123'
        )
        # 2. Add them to group.members list
        self.group.members.add(invitee_user)

        # 3. Create their member record in the group with Email A (e.g. manual creation)
        member = Member.objects.create(
            group=self.group,
            user=invitee_user,
            name='Invitee No Inv Member',
            email='invitee_no_inv@example.com'
        )

        # 4. Edit the member record's email from Email A to Email B
        member.email = 'invitee_no_inv_new@example.com'
        member.save()

        # 5. Try inviting Email A again via the API
        mail.outbox = []
        payload = {'email': 'invitee_no_inv@example.com'}
        response = self.client.post(self.invite_url, payload, format='json')
        
        # 6. Check that the invitation succeeded and returned HTTP_201_CREATED (since no prior invitation existed)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(len(mail.outbox), 1)

    def test_invite_member_duplicate_prevention(self):
        # 1. Invite a member
        payload = {'email': 'duplicate@example.com'}
        response = self.client.post(self.invite_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # 2. Try inviting them again immediately
        mail.outbox = []
        response2 = self.client.post(self.invite_url, payload, format='json')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response2.data)
        self.assertEqual(response2.data['email'][0], 'An active invitation has already been sent to this email.')
        self.assertEqual(len(mail.outbox), 0)

    def test_invite_member_after_expiration(self):
        from django.utils import timezone
        from datetime import timedelta
        # 1. Create a pending invitation
        invitation = Invitation.objects.create(
            group=self.group,
            email='expired@example.com',
            invited_by=self.user,
            status='pending'
        )
        # 2. Update created_at to be in the past (more than 24 hours) using filter update
        Invitation.objects.filter(pk=invitation.pk).update(created_at=timezone.now() - timedelta(hours=25))
        
        # 3. Invite them again
        mail.outbox = []
        payload = {'email': 'expired@example.com'}
        response = self.client.post(self.invite_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify it was renewed
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, 'pending')
        self.assertFalse(invitation.is_expired)
        self.assertEqual(len(mail.outbox), 1)

    def test_expired_invitation_detail_and_actions(self):
        from django.utils import timezone
        from datetime import timedelta
        # 1. Create invitation
        invitation = Invitation.objects.create(
            group=self.group,
            email='expired_actions@example.com',
            invited_by=self.user,
            status='pending'
        )
        Invitation.objects.filter(pk=invitation.pk).update(created_at=timezone.now() - timedelta(hours=25))
        
        # 2. Try fetching details
        detail_url = reverse('api_invitation_detail', kwargs={'pk': invitation.pk})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'This invitation link has expired.')
        
        # 3. Try accepting
        accept_url = reverse('api_accept_invitation', kwargs={'pk': invitation.pk})
        response_accept = self.client.post(accept_url)
        self.assertEqual(response_accept.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response_accept.data['detail'], 'This invitation link has expired.')
        
        # 4. Try declining
        decline_url = reverse('api_decline_invitation', kwargs={'pk': invitation.pk})
        response_decline = self.client.post(decline_url)
        self.assertEqual(response_decline.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response_decline.data['detail'], 'This invitation link has expired.')

class MemberEmailValidationTest(APITestCase):
    def setUp(self):
        # 1. Create a user (group creator/owner)
        self.owner = User.objects.create_user(username='owner', email='owner@example.com', password='password123')
        self.owner_token = Token.objects.create(user=self.owner)
        
        # 2. Create a group
        self.group = Group.objects.create(name='Uniqueness Group', created_by=self.owner)
        self.group.members.add(self.owner)
        
        # 3. Create owner's member profile in the group
        self.owner_member = Member.objects.create(
            group=self.group,
            user=self.owner,
            name='Owner Member',
            email='owner@example.com'
        )

        # 4. Create another member in the group
        self.other_member = Member.objects.create(
            group=self.group,
            name='Other Member',
            email='other@example.com'
        )

        # 5. Create a separate registered user in the system who is also in the group
        self.group_user = User.objects.create_user(username='groupuser', email='groupuser@example.com', password='password123')
        self.group.members.add(self.group_user)
        self.group_user_member = Member.objects.create(
            group=self.group,
            user=self.group_user,
            name='Group User Member',
            email='groupuser@example.com'
        )

        # Authenticate client as the owner
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.owner_token.key)
        self.member_list_url = reverse('api_member_list_create', kwargs={'group_pk': self.group.pk})

    def test_create_member_with_duplicate_member_email_fails(self):
        # Trying to add a new member with an email that is already used by self.other_member ('other@example.com')
        payload = {
            'name': 'New Member Dupe',
            'email': 'other@example.com'
        }
        response = self.client.post(self.member_list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertEqual(response.data['email'][0], 'This email is already in use.')

    def test_create_member_with_duplicate_user_email_fails(self):
        # Trying to add a new member with an email that is already used by self.group_user ('groupuser@example.com')
        payload = {
            'name': 'New Member Dupe User',
            'email': 'groupuser@example.com'
        }
        response = self.client.post(self.member_list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertEqual(response.data['email'][0], 'This email is already in use.')

    def test_update_member_with_duplicate_email_fails(self):
        # Trying to update self.other_member's email to 'groupuser@example.com' (already in use by self.group_user / self.group_user_member)
        url = reverse('api_member_detail_update_delete', kwargs={'group_pk': self.group.pk, 'pk': self.other_member.pk})
        payload = {
            'name': 'Other Member',
            'email': 'groupuser@example.com'
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertEqual(response.data['email'][0], 'This email is already in use.')

    def test_update_member_to_own_email_succeeds(self):
        # Updating self.other_member's details but keeping their own email 'other@example.com'
        url = reverse('api_member_detail_update_delete', kwargs={'group_pk': self.group.pk, 'pk': self.other_member.pk})
        payload = {
            'name': 'Other Member Renamed',
            'email': 'other@example.com'
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'other@example.com')
        self.assertEqual(response.data['name'], 'Other Member Renamed')

    def test_update_member_to_new_unique_email_succeeds(self):
        # Updating self.other_member's email to a new unused email
        url = reverse('api_member_detail_update_delete', kwargs={'group_pk': self.group.pk, 'pk': self.other_member.pk})
        payload = {
            'name': 'Other Member',
            'email': 'unused_new@example.com'
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'unused_new@example.com')

class ProfileAndChangePasswordTest(APITestCase):
    def setUp(self):
        # Create test users
        self.user = User.objects.create_user(username='profileuser', email='profile@example.com', password='password123')
        self.user_token = Token.objects.create(user=self.user)
        
        self.other_user = User.objects.create_user(username='otheruser', email='otheruser@example.com', password='password123')
        
        # Authenticate
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.user_token.key)
        self.me_url = reverse('api_me')
        self.change_password_url = reverse('api_change_password')

        # Create a group where self.user is a member and creator
        self.group = Group.objects.create(name='User Group', created_by=self.user)
        self.group.members.add(self.user)

    def test_get_profile_succeeds_and_returns_statistics(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'profileuser')
        self.assertEqual(response.data['email'], 'profile@example.com')
        self.assertEqual(response.data['total_groups_joined'], 1)
        self.assertEqual(response.data['groups_created_count'], 1)
        self.assertIn('date_joined', response.data)
        self.assertEqual(response.data['full_name'], '')

    def test_update_profile_succeeds(self):
        payload = {
            'username': 'profileuser_updated',
            'email': 'profile_updated@example.com',
            'full_name': 'John Doe'
        }
        response = self.client.put(self.me_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'profileuser_updated')
        self.assertEqual(response.data['email'], 'profile_updated@example.com')
        self.assertEqual(response.data['full_name'], 'John Doe')
        
        # Verify changes in DB
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'profileuser_updated')
        self.assertEqual(self.user.email, 'profile_updated@example.com')
        self.assertEqual(self.user.first_name, 'John')
        self.assertEqual(self.user.last_name, 'Doe')

    def test_update_profile_duplicate_username_fails(self):
        payload = {
            'username': 'otheruser',
            'email': 'unique_email@example.com',
            'full_name': 'Jane Doe'
        }
        response = self.client.put(self.me_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)
        self.assertEqual(response.data['username'][0], 'A user with this username already exists.')

    def test_update_profile_duplicate_email_fails(self):
        payload = {
            'username': 'profileuser',
            'email': 'otheruser@example.com',
            'full_name': 'Jane Doe'
        }
        response = self.client.put(self.me_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertEqual(response.data['email'][0], 'A user with this email already exists.')

    def test_change_password_succeeds(self):
        payload = {
            'current_password': 'password123',
            'new_password': 'SecureNewPassword123',
            'confirm_password': 'SecureNewPassword123'
        }
        response = self.client.post(self.change_password_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['detail'], 'Password changed successfully.')
        
        # Verify authentication with the new password
        from django.contrib.auth import authenticate
        user = authenticate(username='profileuser', password='SecureNewPassword123')
        self.assertIsNotNone(user)

    def test_change_password_incorrect_current_fails(self):
        payload = {
            'current_password': 'wrong_password',
            'new_password': 'SecureNewPassword123',
            'confirm_password': 'SecureNewPassword123'
        }
        response = self.client.post(self.change_password_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', response.data)
        self.assertEqual(response.data['current_password'], 'Incorrect current password.')

    def test_change_password_mismatched_new_fails(self):
        payload = {
            'current_password': 'password123',
            'new_password': 'SecureNewPassword123',
            'confirm_password': 'DifferentNewPassword123'
        }
        response = self.client.post(self.change_password_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.data)
        self.assertEqual(response.data['confirm_password'], 'New passwords do not match.')
