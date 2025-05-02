// Store the original upload_files method
const originalUploadFiles = frappe.ui.FileUploader.prototype.upload_files;

// Replace upload_files with custom logic
frappe.ui.FileUploader.prototype.upload_files = function() {
    const chunkSize = 20 * 1024 * 1024; // 20MB
    const url = '/api/method/mods.mods.upload.multipart_file_upload';

    const upload_file = (file, index) => {
        // Calculate total chunks
        const totalChunks = Math.ceil(file.file_obj.size / chunkSize);

        this.uploader.currently_uploading = index;
        file.uploading = true;

        const uploadChunks = async() => {

            console.log("Uploader Props", this.uploader.$props);

            // Upload each chunk
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * chunkSize;
                const end = Math.min(start + chunkSize, file.file_obj.size);
                const chunk = file.file_obj.slice(start, end);

                // Create FormData for the chunk
                const formData = new FormData();
                formData.append('file', chunk, file.name);
                formData.append('dzchunkindex', chunkIndex);
                formData.append('dzchunkbyteoffset', start);
                formData.append('dztotalchunkcount', totalChunks);
                formData.append('dztotalfilesize', file.file_obj.size);
                formData.append("folder", this.uploader.$props.folder);
                if (this.uploader.$props.doctype) {
                    formData.append("doctype", this.uploader.$props.doctype);
                }
        
                if (this.uploader.$props.docname) {
                    formData.append("docname", this.uploader.$props.docname);
                }
                formData.append("is_private", +file.private);

                const send = async () => {
                    try {
                        // Make the API request
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                            'X-Frappe-CSRF-Token': frappe.csrf_token,
                            },
                            body: formData,
                        });

                        const result = await response.json();
                        if (result.exc) {
                            frappe.msgprint(__('Error uploading chunk: ') + result.exc);
                            return 1;
                        } else {
                            console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded`);
                        }
                    } catch (error) {
                        frappe.msgprint(__('Upload failed: ') + error.message);
                        return 1;
                    }
                }

                const error = await send();

                if(error) return error;
                if(chunkIndex + 1 == totalChunks) {
                    // frappe.msgprint(__('File upload completed'));
                    this.uploader.close_dialog = true;
                }
            }
        }

        uploadChunks();
    }

    const upload_via_file_browser = () => {
        let selected_file = this.uploader.file_browser.selected_node;
        if (!selected_file) {
            frappe.msgprint(__("Click on a file to select it."));
            this.uploader.close_dialog = true;
            return Promise.reject();
        }
        this.uploader.close_dialog = true;
        return this.uploader.upload_file({
            library_file_name: selected_file,
        });
    }

    const upload_via_web_link = () => {
        let file_url = this.uploader.web_link.url;
        if (!file_url) {
            frappe.msgprint(__("Invalid URL"));
            this.uploader.close_dialog = true;
            return Promise.reject();
        }
        file_url = decodeURI(file_url);
        this.uploader.close_dialog = true;
        return this.uploader.upload_file({
            file_url,
        });
    }
    
    const return_as_dataurl = () => {
        let promises = this.uploader.files.map((file) =>
            frappe.dom.file_to_base64(file.file_obj).then((dataurl) => {
                file.dataurl = dataurl;
                this.uploader.$props.on_success && this.uploader.$props.on_success(file);
            })
        );
        this.uploader.close_dialog = true;
        return Promise.all(promises);
    }

    if (this.uploader.show_file_browser) {
		return upload_via_file_browser();
	}
	if (this.uploader.show_web_link) {
		return upload_via_web_link();
	}
	if (this.uploader.$props.as_dataurl) {
		return return_as_dataurl();
	}
	if (!this.uploader.files.length) {
		frappe.msgprint(__("Please select a file first."));
		return Promise.reject();
	}

	this.dialog?.get_primary_btn().prop("disabled", true);
	this.dialog?.get_secondary_btn().prop("disabled", true);

	return frappe.run_serially(this.uploader.files.map((file, i) => () => upload_file(file, i)));
};