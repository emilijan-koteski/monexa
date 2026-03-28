package types

type ExportFormatType string

const (
	ExportFormatCSV  ExportFormatType = "CSV"
	ExportFormatJSON ExportFormatType = "JSON"
)

var ValidExportFormats = map[ExportFormatType]bool{
	ExportFormatCSV:  true,
	ExportFormatJSON: true,
}
