locals {
  developers_roles = [
    "roles/cloudfunctions.admin",
    "roles/cloudscheduler.admin",
    "roles/cloudtasks.admin",
    "roles/firebase.admin",
    "roles/errorreporting.user",
    "roles/secretmanager.admin",
    "roles/storage.admin",
  ]
}

resource "google_project_iam_member" "operations" {
  count  = length(local.developers_roles)
  role   = local.developers_roles[count.index]
  member = "group:developers@erouska.cz"
}
