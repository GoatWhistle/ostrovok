variable "COMPOSE_PROJECT_NAME" {
  default = "hotel-agent"
}

variable "TAG" {
  default = "latest"
}

variable "SITE_URL" {
  default = ""
}

group "default" {
  targets = ["backend", "frontend"]
}

target "backend" {
  context = "backend"
  tags = ["${COMPOSE_PROJECT_NAME}-backend:${TAG}"]
  output = ["type=docker"]
}

target "frontend" {
  context = "frontend"
  args = {
    SITE_URL = SITE_URL
  }
  tags = ["${COMPOSE_PROJECT_NAME}-frontend:${TAG}"]
  output = ["type=docker"]
}
