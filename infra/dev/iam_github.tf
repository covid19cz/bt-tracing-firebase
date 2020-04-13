locals {

  github_firebase_roles = [
    "roles/firebase.admin",
    "roles/cloudfunctions.admin",
    "roles/cloudscheduler.admin",
    "roles/iam.serviceAccountUser"
  ]

  github_homepage_roles = [
    "roles/firebasehosting.admin",
    "roles/cloudconfig.admin"
  ]
}

resource "google_project_iam_member" "github-firebase" {
  count  = length(local.github_firebase_roles)
  role   = local.github_firebase_roles[count.index]
  member = "serviceAccount:${google_service_account.github-firebase.email}"
}

resource "google_project_iam_member" "github-homepage" {
  count  = length(local.github_homepage_roles)
  role   = local.github_homepage_roles[count.index]
  member = "serviceAccount:${google_service_account.github-homepage.email}"
}

resource "google_service_account" "github-firebase" {
  account_id   = "github-firebase"
  display_name = "github-actions deploy to firebase functions"
}

resource "google_service_account" "github-homepage" {
  account_id   = "github-homepage"
  display_name = "github-actions deploy to firebase hosting"
}
