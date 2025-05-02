
# Copyright (c) 2025, Revant Nandgaonkar and contributors
# License: MIT
# references:
# https://stackoverflow.com/a/53001103
# https://github.com/frappe/drive/blob/main/frontend/src/components/FileUploader.vue
# https://github.com/frappe/frappe/blob/develop/frappe/client.py

import os

import frappe
from frappe.utils import cint
from werkzeug.utils import secure_filename

class FileAlreadyExistsException(Exception):
    http_status_code = 400


class InternalServerException(Exception):
    http_status_code = 500


@frappe.whitelist(methods=["POST"])
def multipart_file_upload(*args, **kwargs):
    file = frappe.request.files["file"]
    filename = secure_filename(file.filename)

    is_private = frappe.form_dict.is_private or 1
    file_dir = "private/files" if is_private else "public/files"
    file_url = os.path.join(
        "/private/files" if is_private else "/files",
        filename,
    )
    save_path = os.path.join(frappe.get_site_path(file_dir), filename)
    current_chunk = int(frappe.form_dict.dzchunkindex)

    if os.path.exists(save_path) and current_chunk == 0:
        # delete existing file, being replaced
        os.remove(save_path)

    try:
        with open(save_path, "ab") as f:
            f.seek(int(frappe.form_dict.dzchunkbyteoffset))
            f.write(file.stream.read())
    except OSError as e:
        frappe.log_error("Could not write to file", e)

        return frappe.throw(
            ("Not sure why, but we couldn't write the file to disk"),
            exc=InternalServerException,
        )

    total_chunks = int(frappe.form_dict.dztotalchunkcount)

    if current_chunk + 1 == total_chunks:
        if os.path.getsize(save_path) != int(frappe.form_dict.dztotalfilesize):
            frappe.log_error(
                f"File {filename} was completed, "
                f"but has a size mismatch."
                f"Was {os.path.getsize(save_path)} but we"
                f" expected {frappe.form_dict.dztotalfilesize} "
            )
            # delete incomplete file
            os.remove(save_path)
            return frappe.throw("Size mismatch", exc=InternalServerException)
        else:
            frappe.log(f"File {filename} has been uploaded successfully")

            doctype = frappe.form_dict.doctype
            docname = frappe.form_dict.docname
            fieldname = frappe.form_dict.fieldname
            folder = frappe.form_dict.folder or "Home"
            frappe_file = frappe.get_doc(
                {
                    "doctype": "File",
                    "attached_to_doctype": doctype,
                    "attached_to_name": docname,
                    "attached_to_field": fieldname,
                    "folder": folder,
                    "file_name": filename,
                    "file_url": file_url,
                    "is_private": cint(is_private),
                }
            )
            frappe_file.save(ignore_permissions=True)
    else:
        frappe.log(
            (
                f"Chunk {current_chunk + 1} of "
                f"{total_chunks} for file {filename} complete"
            )
        )

    return "Chunk upload successful"