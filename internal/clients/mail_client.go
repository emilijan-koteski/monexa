package clients

import (
	"fmt"
	"log"
	"os"

	"github.com/resend/resend-go/v3"
)

type MailClient struct {
	client      *resend.Client
	fromName    string
	fromAddress string
}

func NewMailClient() *MailClient {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		log.Fatal("⛔ Exit!!! Missing RESEND_API_KEY")
	}

	fromName := os.Getenv("RESEND_FROM_NAME")
	if fromName == "" {
		log.Fatal("⛔ Exit!!! Missing RESEND_FROM_NAME")
	}

	fromAddress := os.Getenv("RESEND_FROM_ADDRESS")
	if fromAddress == "" {
		log.Fatal("⛔ Exit!!! Missing RESEND_FROM_ADDRESS")
	}

	client := resend.NewClient(apiKey)

	return &MailClient{
		client:      client,
		fromName:    fromName,
		fromAddress: fromAddress,
	}
}

func (c *MailClient) SendText(to, subject, body string) error {
	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", c.fromName, c.fromAddress),
		To:      []string{to},
		Subject: subject,
		Text:    body,
	}
	_, err := c.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	return nil
}

func (c *MailClient) SendHTML(to, subject, htmlBody string) error {
	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", c.fromName, c.fromAddress),
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
	}
	_, err := c.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	return nil
}
