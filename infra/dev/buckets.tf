resource "google_storage_bucket" "main-bucket" {
  name          = "${var.project}.appspot.com"
  location      = "eu"

  lifecycle_rule {
    condition {
      age = "2"
    }
    action {
      type = "Delete"
    }
  }
}
