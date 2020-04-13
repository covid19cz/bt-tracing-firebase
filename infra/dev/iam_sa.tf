resource "google_service_account" "register-buid" {
  account_id   = "register-buid"
  display_name = "register-buid firebase function service account"
}

resource "google_service_account" "is-buid-active" {
  account_id   = "is-buid-active"
  display_name = "is-buid-active firebase function service account"
}

resource "google_service_account" "delete-user" {
  account_id   = "delete-user"
  display_name = "delete-user firebase function service account"
}

resource "google_service_account" "delete-buid" {
  account_id   = "delete-buid"
  display_name = "delete-buid firebase function service account"
}

resource "google_service_account" "delete-uploads" {
  account_id   = "delete-uploads"
  display_name = "delete-uploads firebase function service account"
}

resource "google_service_account" "change-push-token" {
  account_id   = "change-push-token"
  display_name = "change-push-token firebase function service account"
}

resource "google_service_account" "database-backup" {
  account_id   = "database-backup"
  display_name = "database-backup firebase function service account"
}

resource "google_service_account" "aws-poller" {
  account_id   = "aws-poller"
  display_name = "aws-poller firebase function service account"
}

resource "google_service_account" "delete-old-users" {
  account_id   = "delete-old-users"
  display_name = "delete-old-users firebase function service account"
}

resource "google_service_account" "delete-upload-task" {
  account_id   = "delete-upload-task"
  display_name = "delete-upload-task firebase function service account"
}

resource "google_service_account" "delete-user-trigger" {
  account_id   = "delete-user-trigger"
  display_name = "delete-user-trigger firebase function service account"
}

resource "google_service_account" "create-object-trigger" {
  account_id   = "create-object-trigger"
  display_name = "create-object-trigger firebase function service account"
}
