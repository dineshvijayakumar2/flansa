"""
Compatibility wrapper for tenant_service -> workspace_service migration
This file ensures backward compatibility during deployment
"""

# Import everything from workspace_service for backward compatibility
from flansa.flansa_core.workspace_service import *

# Import workspace_security functions that might be needed
from flansa.flansa_core.workspace_security import (
    get_current_workspace,
    apply_workspace_filter
)

# Create TenantContext class for backward compatibility
class TenantContext:
    @staticmethod
    def get_current_tenant_id():
        return get_current_workspace()
    
    @staticmethod
    def _get_default_tenant():
        return get_current_workspace()

# Ensure resolve_tenant_from_request is available
from flansa.flansa_core.workspace_service import resolve_tenant_from_request