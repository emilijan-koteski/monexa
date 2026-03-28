package types

type ExportCategoryType string

const (
	ExportCategoryProfile        ExportCategoryType = "EXPORT_PROFILE"
	ExportCategoryRecords        ExportCategoryType = "EXPORT_RECORDS"
	ExportCategoryCategories     ExportCategoryType = "EXPORT_CATEGORIES"
	ExportCategoryPaymentMethods ExportCategoryType = "EXPORT_PAYMENT_METHODS"
	ExportCategoryPreferences    ExportCategoryType = "EXPORT_PREFERENCES"
	ExportCategoryConsent        ExportCategoryType = "EXPORT_CONSENT"
)

var AllExportCategories = []ExportCategoryType{
	ExportCategoryProfile,
	ExportCategoryRecords,
	ExportCategoryCategories,
	ExportCategoryPaymentMethods,
	ExportCategoryPreferences,
	ExportCategoryConsent,
}

var ValidExportCategories = map[ExportCategoryType]bool{
	ExportCategoryProfile:        true,
	ExportCategoryRecords:        true,
	ExportCategoryCategories:     true,
	ExportCategoryPaymentMethods: true,
	ExportCategoryPreferences:    true,
	ExportCategoryConsent:        true,
}
