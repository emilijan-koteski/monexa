package services

import (
	"strings"
	"testing"

	"github.com/emilijan-koteski/monexa/internal/models/types"
)

func TestRenderTemplateUsesFrontendURLForLinksAndLogo(t *testing.T) {
	t.Chdir("../..") // templates are resolved relative to the repo root, as in production
	t.Setenv("FRONTEND_URL", "https://example.test")
	mail := NewMailService(nil)
	data := map[string]string{
		"UserName":      "Ana",
		"ResetURL":      "https://example.test/reset-password?token=x",
		"ReactivateURL": "https://example.test/login",
		"DeletePeriod":  "in 7 days",
	}

	for _, name := range []string{PasswordResetTemplate, AccountDeletionTemplate} {
		for _, lang := range []types.LanguageType{types.EnglishLanguage, types.MacedonianLanguage} {
			t.Run(mail.GetEmailTemplatePath(name, lang), func(t *testing.T) {
				html, err := mail.RenderTemplate(name, lang, data)
				if err != nil {
					t.Fatal(err)
				}
				if strings.Contains(html, "monexa.world") {
					t.Error("rendered email still contains the hardcoded domain")
				}
				for _, want := range []string{"href='https://example.test/'", "src='https://example.test/monexa-logo.png'"} {
					if !strings.Contains(html, want) {
						t.Errorf("missing %q", want)
					}
				}
			})
		}
	}
}
