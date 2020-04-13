provider "google" {
  project = var.project
  region  = var.region
}

terraform {
  backend "gcs" {
    bucket = "erouska-terraform-state-prod"
    prefix = "terraform/state"
  }
}
