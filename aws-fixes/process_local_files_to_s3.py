#!/usr/bin/env python3
"""
Process Local Files to S3
Convert existing local files to S3 storage
"""

print("🔧 PROCESSING LOCAL FILES TO S3", flush=True)
print("=" * 50, flush=True)

def process_local_files_to_s3():
    """Process existing local files to S3"""
    import frappe

    try:
        print("📋 Step 1: Finding local files to process...", flush=True)

        # Find files with local URLs
        local_files = frappe.get_all("File",
                                    filters=[
                                        ["file_url", "like", "/private/files/%"],
                                        ["creation", ">", "2025-09-16 15:00:00"]  # Recent files
                                    ],
                                    fields=["name", "file_name", "file_url", "creation"])

        print(f"Found {len(local_files)} local files to process", flush=True)

        if not local_files:
            print("✅ No local files found to process", flush=True)
            return True

        print("📋 Step 2: Processing files to S3...", flush=True)

        from flansa.flansa_core.s3_integration.doc_events import process_s3_upload_safe

        processed_count = 0
        for file_info in local_files:
            try:
                print(f"Processing: {file_info.file_name} ({file_info.creation})", flush=True)

                # Get the full document
                doc = frappe.get_doc("File", file_info.name)

                # Process to S3
                process_s3_upload_safe(doc)

                # Check if it was successful
                doc.reload()
                if 's3://' in doc.file_url or 'amazonaws' in doc.file_url.lower():
                    processed_count += 1
                    print(f"  ✅ Successfully processed to S3", flush=True)
                else:
                    print(f"  ❌ Still local after processing", flush=True)

            except Exception as e:
                print(f"  ❌ Error processing {file_info.file_name}: {str(e)}", flush=True)

        print(f"📋 Step 3: Processed {processed_count}/{len(local_files)} files", flush=True)

        print("🎉 Local files processing completed!", flush=True)
        return True

    except Exception as e:
        print(f"❌ Error processing local files: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute
try:
    result = process_local_files_to_s3()

    if result:
        print("🎉 Processing completed successfully!", flush=True)
    else:
        print("❌ Processing failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)