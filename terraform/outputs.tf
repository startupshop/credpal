output "alb_dns_name" {
  description = "ALB DNS name — create a CNAME record in Cloudflare pointing cred.tpas.aggregatorlink.pw to this value with proxy enabled"
  value       = aws_lb.main.dns_name
}

output "ec2_public_ip" {
  description = "EC2 public IP — used for EC2_HOST GitHub Secret"
  value       = aws_instance.app.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}
