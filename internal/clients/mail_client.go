package clients

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/wneessen/go-mail"
)

type MailClient struct {
	client      *mail.Client
	fromName    string
	fromAddress string
}

func NewMailClient() *MailClient {
	port, err := strconv.Atoi(os.Getenv("SMTP_PORT"))
	if err != nil {
		log.Fatal("⛔ Exit!!! Invalid or missing SMTP_PORT")
	}

	client, err := mail.NewClient(os.Getenv("SMTP_HOST"),
		mail.WithPort(port),
		mail.WithTLSPortPolicy(mail.TLSMandatory),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(os.Getenv("SMTP_USER")),
		mail.WithPassword(os.Getenv("SMTP_PASS")),
	)
	if err != nil {
		log.Fatal("⛔ Exit!!! Failed to create mail client")
	}

	return &MailClient{
		client:      client,
		fromName:    os.Getenv("SMTP_FROM_NAME"),
		fromAddress: os.Getenv("SMTP_USER"),
	}
}

func (c *MailClient) SendText(to, subject, body string) error {
	return c.send(to, subject, body, mail.TypeTextPlain)
}

func (c *MailClient) SendHTML(to, subject, htmlBody string) error {
	return c.send(to, subject, htmlBody, mail.TypeTextHTML)
}

func (c *MailClient) send(to, subject, body string, contentType mail.ContentType) error {
	msg := mail.NewMsg()
	if err := msg.FromFormat(c.fromName, c.fromAddress); err != nil {
		return fmt.Errorf("failed to set FROM address: %w", err)
	}
	if err := msg.To(to); err != nil {
		return fmt.Errorf("failed to set TO address: %w", err)
	}
	msg.Subject(subject)
	msg.SetBodyString(contentType, body)

	if err := c.client.DialAndSend(msg); err != nil {
		return fmt.Errorf("failed to send mail: %w", err)
	}

	return nil
}
