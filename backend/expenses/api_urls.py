from django.urls import path
from . import api_views

urlpatterns = [
    # Auth endpoints
    path('register/', api_views.api_register, name='api_register'),
    path('login/', api_views.api_login, name='api_login'),
    path('logout/', api_views.api_logout, name='api_logout'),
    path('me/', api_views.api_me, name='api_me'),
    path('change-password/', api_views.api_change_password, name='api_change_password'),
    
    # Groups
    path('groups/', api_views.group_list_create, name='api_group_list_create'),
    path('groups/<int:pk>/', api_views.group_detail_update_delete, name='api_group_detail_update_delete'),
    
    # Members
    path('groups/<int:group_pk>/members/', api_views.member_list_create, name='api_member_list_create'),
    path('groups/<int:group_pk>/members/<int:pk>/', api_views.member_detail_update_delete, name='api_member_detail_update_delete'),
    
    # Expenses
    path('groups/<int:group_pk>/expenses/', api_views.expense_list_create, name='api_expense_list_create'),
    path('groups/<int:group_pk>/expenses/<int:pk>/', api_views.expense_detail_update_delete, name='api_expense_detail_update_delete'),
    
    # Split
    path('groups/<int:group_pk>/expenses/<int:expense_pk>/split/preview-equal/', api_views.preview_equal_split, name='api_preview_equal_split'),
    path('groups/<int:group_pk>/expenses/<int:expense_pk>/split/save/', api_views.save_expense_splits, name='api_save_expense_splits'),
    
    # Balances
    path('groups/<int:group_pk>/balances/', api_views.group_balances, name='api_group_balances'),
    path('groups/<int:group_pk>/members/<int:member_pk>/ledger/', api_views.member_ledger, name='api_member_ledger'),
    
    # Settlements
    path('groups/<int:group_pk>/settlements/', api_views.settlement_list_create, name='api_settlement_list_create'),
    path('groups/<int:group_pk>/settlements/<int:pk>/complete/', api_views.complete_settlement, name='api_complete_settlement'),
    
    # Budget
    path('groups/<int:group_pk>/budget/', api_views.group_budget, name='api_group_budget'),

    # Invitations
    path('invitations/', api_views.list_pending_invitations, name='api_list_pending_invitations'),
    path('invitations/<int:pk>/', api_views.get_invitation_detail, name='api_invitation_detail'),
    path('invitations/<int:pk>/accept/', api_views.accept_invitation, name='api_accept_invitation'),
    path('invitations/<int:pk>/decline/', api_views.decline_invitation, name='api_decline_invitation'),
    path('groups/<int:group_pk>/invitations/', api_views.invite_member, name='api_invite_member'),
    path('groups/<int:group_pk>/invitations/list/', api_views.list_group_invitations, name='api_list_group_invitations'),
]
