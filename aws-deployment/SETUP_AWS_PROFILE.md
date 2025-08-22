# Setting Up Personal AWS Profile for Flansa

## Step 1: Create IAM User in Your Personal AWS Account

1. **Log in to your personal AWS Console**
   - Go to https://console.aws.amazon.com
   - Use your personal AWS account (NOT company account)

2. **Create IAM User**
   - Go to IAM → Users → Create User
   - User name: `flansa-deployer`
   - Access type: ✅ Programmatic access

3. **Attach Permissions**
   - Click "Attach policies directly"
   - For MVP, attach these managed policies:
     - `AmazonRDSFullAccess`
     - `AmazonElastiCacheFullAccess`
     - `AmazonEC2FullAccess` (for security groups)
     - `AWSAppRunnerFullAccess`
     - `AmazonEC2ContainerRegistryFullAccess` (for Docker images)

4. **Save Credentials**
   - Download the CSV file with Access Key ID and Secret Access Key
   - Keep these secure!

## Step 2: Configure AWS CLI Profile

Run these commands in your terminal:

```bash
# Configure the new profile
aws configure set aws_access_key_id YOUR_ACCESS_KEY_ID --profile flansa-personal
aws configure set aws_secret_access_key YOUR_SECRET_ACCESS_KEY --profile flansa-personal
aws configure set region us-east-1 --profile flansa-personal
aws configure set output json --profile flansa-personal
```

Or manually edit `~/.aws/credentials`:

```ini
[flansa-personal]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
```

And `~/.aws/config`:

```ini
[profile flansa-personal]
region = us-east-1
output = json
```

## Step 3: Verify the Profile

```bash
# Test the new profile
aws sts get-caller-identity --profile flansa-personal

# Should show your personal account details
```

## Step 4: Update the Setup Script

Once configured, update the setup script to use the personal profile:

```bash
# In setup-aws-infrastructure.sh, change:
AWS_PROFILE="flansa-personal"  # Instead of flansa-deployment
```

## Alternative: Use Environment Variables

If you prefer not to save credentials, you can use environment variables:

```bash
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_DEFAULT_REGION="us-east-1"

# Then run AWS commands without --profile flag
```

## Security Best Practices

1. **Never commit AWS credentials** to Git
2. **Use IAM roles** for production
3. **Enable MFA** on your AWS root account
4. **Rotate access keys** regularly
5. **Use least privilege** - only grant necessary permissions

## Quick Setup Commands

After getting your credentials from AWS Console:

```bash
# 1. Set up profile (replace with your actual keys)
aws configure set aws_access_key_id AKIAIOSFODNN7EXAMPLE --profile flansa-personal
aws configure set aws_secret_access_key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY --profile flansa-personal
aws configure set region us-east-1 --profile flansa-personal

# 2. Verify it works
aws sts get-caller-identity --profile flansa-personal

# 3. Run the infrastructure setup
./setup-aws-infrastructure.sh
```

---

**Note**: Make sure you're using your personal AWS account, not the company account (567106097357).