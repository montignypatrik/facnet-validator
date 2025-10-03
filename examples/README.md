# Example Files

This directory contains sample files for testing and demonstration purposes.

## Files

- **sample_billing.csv**: Example Quebec healthcare billing data for testing the Validateur module
  - Contains anonymized RAMQ billing records
  - Use for testing validation rules and CSV processing
  - Format: 23 columns matching Quebec RAMQ billing structure

## Usage

Upload these files through the Dash Validateur module to see validation in action:

1. Navigate to **Validateur** → **Upload**
2. Drag and drop `sample_billing.csv`
3. Click **Start Validation**
4. View results in **Runs** tab

## Data Structure

The sample billing CSV includes fields for:
- Service dates and times
- Billing codes (RAMQ)
- Context elements
- Establishment information
- Patient identifiers (anonymized)
- Amounts (preliminary and paid)
