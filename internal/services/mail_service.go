package services

import (
	"path/filepath"

	"github.com/emilijan-koteski/monexa/internal/clients"
	"github.com/emilijan-koteski/monexa/internal/models/types"
)

const (
	PasswordResetTemplate = "templates/email/password_reset.html"
)

var emailSubjects = map[string]map[types.LanguageType]string{
	PasswordResetTemplate: {
		types.EnglishLanguage:    "Reset your password",
		types.MacedonianLanguage: "Ресетирајте ја вашата лозинка",
	},
}

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

func (s *MailService) GetEmailTemplatePath(template string, language types.LanguageType) string {
	if language == types.MacedonianLanguage {
		dir := filepath.Dir(template)
		file := filepath.Base(template)
		return filepath.Join(dir, "mk", file)
	}
	return template
}

func (s *MailService) GetEmailSubject(template string, language types.LanguageType) string {
	if subjects, ok := emailSubjects[template]; ok {
		if subject, ok := subjects[language]; ok {
			return subject
		}
	}
	return ""
}
