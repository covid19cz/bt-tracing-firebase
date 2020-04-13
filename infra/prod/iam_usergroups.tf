locals {
  mobile_operations_roles = [
    "roles/firebase.growthAdmin",
    "roles/firebase.qualityAdmin"
  ]

  operations_roles = [
    "roles/cloudfunctions.admin",
    "roles/cloudscheduler.admin",
    "roles/cloudtasks.admin",
    "roles/firebase.admin",
    "roles/errorreporting.user",
    "roles/secretmanager.admin",
    "roles/storage.admin",
  ]
}

resource "google_project_iam_member" "keboola-owner" {
  role   = "roles/owner"
  member = "group:keboola@erouska.cz"
}

resource "google_project_iam_member" "mobile-operations" {
  count  = length(local.mobile_operations_roles)
  role   = local.mobile_operations_roles[count.index]
  member = "group:mobile-operations@erouska.cz"
}

resource "google_project_iam_member" "operations" {
  count  = length(local.operations_roles)
  role   = local.operations_roles[count.index]
  member = "group:operations@erouska.cz"
}
