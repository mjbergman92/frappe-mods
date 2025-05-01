// Store the original upload_files method
const originalUploadFiles = frappe.ui.FileUploader.prototype.upload_files;

// Replace upload_files with custom logic
frappe.ui.FileUploader.prototype.upload_files = function() {
	// Custom logic
	alert("Replaced attempting to Upload Files!");

	// Example: Log files being uploaded
	console.log('Uploading files:', this.uploader.files);

	// Call the original method
	return originalUploadFiles.call(this);
};