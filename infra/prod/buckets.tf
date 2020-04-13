resource "google_storage_bucket" "main-bucket" {
  name          = "${var.project}.appspot.com"
  location      = "europe-west3"

  lifecycle_rule {
    condition {
      age = "2"
    }
    action {
      type = "Delete"
    }
  }
}
