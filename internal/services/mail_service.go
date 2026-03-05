package services

import (
	"github.com/emilijan-koteski/monexa/internal/clients"
)

type MailService struct {
	mailClient *clients.MailClient
}

func NewMailService(mailClient *clients.MailClient) *MailService {
	return &MailService{mailClient: mailClient}
}

func (s *MailService) SendText(to, subject, body string) error {
	return s.mailClient.SendText(to, subject, body)
}

func (s *MailService) SendHTML(to, subject, htmlBody string) error {
	return s.mailClient.SendHTML(to, subject, htmlBody)
}
