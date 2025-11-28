# compound rules policy for testing AC-2.2.8
package authz_compound

import rego.v1

# compound rule with multiple conditions
allow if {
    is_admin
    is_active
}

# partial rule 1
is_admin if {
    input.user.role == "admin"
}

# partial rule 2
is_active if {
    input.user.status == "active"
}

# alternative path
allow if {
    is_superuser
}

is_superuser if {
    input.user.role == "superuser"
}
