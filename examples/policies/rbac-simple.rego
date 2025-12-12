# RBAC Simple Policy - PolyAgent Example
# =========================================
# This policy demonstrates Role-Based Access Control (RBAC) using OPA.
# RBAC restricts access based on the user's assigned role.
#
# How RBAC works:
# 1. Users are assigned roles (admin, editor, viewer)
# 2. Roles are granted permissions for specific actions
# 3. Access is allowed if user's role has permission for the requested action

package rbac

import rego.v1

# Default deny - if no rule explicitly allows, access is denied
# This is a security best practice: "deny by default"
default allow := false

# Admin role: full access to all resources
# Admins can perform any action on any resource type
allow if {
    input.user.role == "admin"
}

# Editor role: can read and write documents
# Editors have limited permissions compared to admins
allow if {
    input.user.role == "editor"
    input.action in ["read", "write"]
    input.resource.type == "document"
}

# Viewer role: read-only access to documents
# Viewers can only view content, not modify it
allow if {
    input.user.role == "viewer"
    input.action == "read"
    input.resource.type == "document"
}

# Helper rule: check if user has any valid role
# Useful for debugging - shows if the user object is properly formed
has_valid_role if {
    input.user.role in ["admin", "editor", "viewer"]
}
