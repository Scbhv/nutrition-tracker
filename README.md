# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

# Project README

## Overview
This repository contains the source code for a **nutrition tracking application** designed to record and analyze food intake with precise nutrient data.  
The application is optimized for fast logging and integrates with workflows such as **barcode scanning, manual entry, and Apple Health–compatible data structures**.

The project can be edited and maintained in several ways depending on your workflow. Changes made through supported environments will stay synchronized with this repository.

---

# App Features

## Nutrient Tracking
The app allows users to track their daily nutrition based on **nutrient values per 100 g** of food.

Tracked data includes:

- Energy (kcal)
- Macronutrients  
  - Protein  
  - Carbohydrates  
  - Sugars  
  - Fat  
  - Saturated fat
- Sodium
- Micronutrients  
  - Vitamins  
  - Minerals  
  - Amino acids

All nutrients are standardized to **grams per 100 g** to ensure consistent calculations and compatibility with external health systems.

---

## Barcode Scanning
Users can quickly add foods by scanning product barcodes.

The system retrieves or generates structured nutritional data for the scanned item and converts it into the internal format used by the app.

This enables fast logging of packaged foods.

---

## Manual Food Entry
If a food is not available via barcode:

Users can manually enter:

- food name
- nutrient values
- serving size

The application automatically converts the data into the standardized **per-100 g format**.

---

## Serving Size Calculation
Users can define a **custom serving size**, and the application automatically calculates the nutrient values for the consumed portion based on the 100 g reference.

Example:


**Food: Almonds
Reference: per 100 g
Serving eaten: 30 g
→ all nutrients scaled proportionally**


---

## Health Data Compatibility
The structured nutrient data can be exported or integrated with **health tracking systems such as Apple Health**.

This enables:

- accurate nutrition tracking
- integration with fitness or health metrics
- long-term dietary analysis

---

Editing the Application

## 1. Use Lovable (Recommended)
The easiest way to edit the application is through **Lovable**.

1. Open the Lovable project.
2. Start prompting or editing within the Lovable interface.
3. All changes made in Lovable are **automatically committed** to this repository.

---

## 2. Use Your Preferred IDE (Local Development)

You can work locally using any IDE (for example **VS Code**, **WebStorm**, etc.). Changes pushed to this repository will also be reflected in Lovable.

### Requirements

- **Node.js**
- **npm**

Recommended installation method:
---
**nvm install node**

---
**### Setup Instructions**

**#### Step 1 — Clone the repository**
---
```bash
git clone <YOUR_GIT_URL>
---
## Step 2 — Navigate to the project directory 
---
cd <nutrient-tracker>
---
##Step 3 — Install dependencies
---
npm install
---
##Step 4 — Start the development server
---
npm run dev
---
##This starts a development server with:
hot reloading
instant preview**

##3. Edit Files Directly in GitHub
---
You can also edit files directly in the GitHub interface.**

Navigate to the file you want to modify.

Click the Edit button (pencil icon).

Make your changes.

Commit the changes.

---

##4. Use GitHub Codespaces

GitHub Codespaces provides a cloud-based development environment.**

Steps:
Navigate to the main page of the repository

Click the Code button

Open the Codespaces tab

Click New codespace

You can then edit, run, and push changes directly from the browser.
---
##Technologies Used
This project is built with:**
Vite
TypeScript
React
shadcn-ui
Tailwind CSS
Deployment
---
##To deploy the project:**
Open Lovable

Click Share

Select Publish

Lovable will automatically build and deploy the application.
---
##Custom Domain

You can connect a custom domain to your Lovable project.**
Steps:
Go to Project → Settings → Domains
Click Connect Domain
Follow the configuration instructions.
Further documentation:
Setting up a custom domain.


---
##Licence :

## Quellen
- https://react.dev  
- https://vitejs.dev/guide/  
- https://tailwindcss.com/docs  
- https://ui.shadcn.com


