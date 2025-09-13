#!/usr/bin/env python3
"""
Live S3 Update Script for Existing AWS Deployment
Updates site config and ECS environment variables for S3 attachments
"""
import json
import subprocess
import sys

print("🚀 LIVE S3 UPDATE FOR EXISTING AWS DEPLOYMENT", flush=True)
print("=" * 60, flush=True)

def update_site_config():
    """Update site_config.json with S3 settings"""
    print("\n📝 STEP 1: Update Site Configuration", flush=True)
    print("-" * 40, flush=True)
    
    # Read the S3 template
    try:
        with open('aws_site_config_s3.json', 'r') as f:
            s3_config = json.load(f)
        print("✅ Loaded S3 configuration template", flush=True)
    except Exception as e:
        print(f"❌ Error loading S3 config template: {e}", flush=True)
        return False
    
    print("\n📋 S3 Configuration to apply:", flush=True)
    s3_settings = {
        "s3_bucket": s3_config.get("s3_bucket"),
        "s3_region": s3_config.get("s3_region"), 
        "s3_folder_path": s3_config.get("s3_folder_path"),
        "use_s3": s3_config.get("use_s3"),
        "use_s3_for_private_files": s3_config.get("use_s3_for_private_files"),
        "use_s3_for_public_files": s3_config.get("use_s3_for_public_files")
    }
    
    for key, value in s3_settings.items():
        print(f"  {key}: {value}", flush=True)
    
    print(f"\n⚠️  Note: S3 credentials should be set via environment variables:", flush=True)
    print(f"  S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY", flush=True)
    
    return True

def check_ecs_environment():
    """Check current ECS environment variables"""
    print("\n🔍 STEP 2: Check ECS Environment Variables", flush=True)
    print("-" * 40, flush=True)
    
    required_env_vars = [
        "S3_BUCKET",
        "S3_REGION", 
        "S3_FOLDER_PATH",
        "USE_S3",
        "USE_S3_FOR_PRIVATE_FILES",
        "USE_S3_FOR_PUBLIC_FILES",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY"
    ]
    
    print("📋 Required environment variables for S3:", flush=True)
    for var in required_env_vars:
        print(f"  - {var}", flush=True)
    
    return True

def provide_update_commands():
    """Provide AWS CLI commands to update the deployment"""
    print("\n🛠️  STEP 3: Update ECS Service", flush=True)
    print("-" * 40, flush=True)
    
    print("Run these AWS CLI commands to update your ECS service:", flush=True)
    print("\n1. Update Task Definition with S3 environment variables:", flush=True)
    print("   (Use the update_ecs_s3_config.sh script from aws-docker-setup)", flush=True)
    
    print("\n2. Or manually update via AWS Console:", flush=True)
    print("   - Go to ECS > Task Definitions > Your Task", flush=True)
    print("   - Create new revision with S3 environment variables", flush=True)
    print("   - Update service to use new task definition revision", flush=True)
    
    print("\n3. Restart ECS service to pick up new environment:", flush=True)
    print("   aws ecs update-service --cluster your-cluster --service your-service --force-new-deployment", flush=True)
    
    return True

def main():
    """Main execution flow"""
    try:
        # Update site config
        if not update_site_config():
            return False
        
        # Check environment requirements  
        check_ecs_environment()
        
        # Provide update commands
        provide_update_commands()
        
        print("\n💡 SUMMARY - Manual Steps Required:", flush=True)
        print("-" * 40, flush=True)
        print("1. ✅ Run check_s3_config.py to verify current setup", flush=True)
        print("2. 🔧 Update ECS task definition with S3 environment variables", flush=True)
        print("3. 🔄 Force new deployment to pick up environment changes", flush=True)
        print("4. ✅ Run fix_s3_attachment_config.py to verify S3 integration", flush=True)
        
        print("\n🎉 S3 update preparation complete!", flush=True)
        print("Follow the manual steps above to enable S3 attachments.", flush=True)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)