# Raabta Deployment Document

## 1. Application Overview

Raabta is a web based service platform that connects customers, supervisors, service providers and administrators in one system. The application allows users to register, login, request services, track orders, view dashboards and manage service related operations. It solves the problem of managing service requests manually by giving each role a digital dashboard and API based workflow.

The project has a frontend built using HTML, CSS and JavaScript. The backend is built using Node.js and Express.js with Supabase as the database. The backend is containerized using Docker and deployed on an AWS EC2 instance.

Although the assignment document originally mentions Flask, this implementation uses Node.js and Express.js because the Raabta project backend was already developed in JavaScript. The same DevOps requirements were followed, including API routes, POST routes, health check, Docker containerization, automated tests, GitHub Actions CI/CD and AWS EC2 deployment.

### Main API Endpoints

| Method | URL | Purpose |
|---|---|---|
| GET | `/health` | Confirms that the backend is running |
| POST | `/api/auth/signup` | Registers a new user |
| POST | `/api/auth/login` | Logs in an existing user |
| GET | `/api/services` | Returns enabled services |
| GET | `/api/orders/track/:orderId` | Tracks an order using its order ID |
| GET | `/api/customer/dashboard` | Shows customer dashboard data, protected route |
| GET | `/api/customer/orders` | Shows customer order history, protected route |
| POST | `/api/orders` | Creates a new customer order, protected route |
| POST | `/api/complaints` | Allows a customer to submit a complaint |
| GET | `/api/supervisor/orders` | Shows orders for supervisor or admin |
| POST | `/api/supervisor/assign` | Assigns an order to a provider |
| POST | `/api/supervisor/status` | Updates order status |
| GET | `/api/admin/dashboard` | Shows admin analytics dashboard |
| GET | `/api/admin/users` | Shows all users for admin |
| GET | `/api/admin/services` | Shows services with order counts |
| POST | `/api/admin/services` | Adds a new service |
| PATCH | `/api/admin/services/:id` | Updates service details |
| PATCH | `/api/admin/complaints/:id/resolve` | Resolves a complaint |

## 2. Architecture Diagram

```text
User Browser
     |
     |  HTTP request
     v
EC2 Public IP:5000
     |
     v
AWS EC2 Instance Ubuntu 22.04
     |
     v
Docker Container raabta-backend-container
     |
     v
Node.js Express Backend
     |
     | serves frontend files from /frontend
     | handles API requests from /api routes
     v
Supabase Database 



omponent Description
ComponentRoleBrowserUser opens the frontend and sends API requestsEC2 Public IPPublic entry point for the deployed appAWS EC2Cloud server where the project is deployedDocker ContainerRuns the backend application in an isolated environmentNode.js Express BackendHandles API routes, authentication and business logicFrontend FilesHTML, CSS and JS served by the backendSupabaseStores users, services, orders, complaints and role data
3. Tools and Technologies
Tool or TechnologyWhy it was usedUbuntu LinuxUsed locally in a virtual machine and on EC2 for running commands and deploymentGitUsed for version controlGitHubUsed to store the repository and commit historyGitHub ActionsUsed to run automated tests and Docker build checksNode.jsRuntime environment for the backendExpress.jsBackend framework used to create REST API endpointsJavaScriptUsed for both frontend logic and backend codeHTMLUsed to build the frontend pageCSSUsed to style the frontend pageSupabaseUsed as the backend database serviceDockerUsed to containerize the backend applicationAWS EC2Used to deploy the Dockerized application publiclycurlUsed to test API endpoints from terminalJestUsed for automated backend testingSupertestUsed to test Express API routes without manually opening a browser
4. Local Setup Instructions
These steps explain how to run the project locally from a fresh clone.
Step 1: Clone the repository
git clone https://github.com/Shoaib2566/Raabta.gitcd Raabta
Step 2: Go to the backend folder
cd V1/backend
Step 3: Install dependencies
npm install
Step 4: Run backend tests
npm test
Expected result:
PASS tests/server.test.jsTests: 6 passed, 6 total
Step 5: Build Docker image locally
The Docker build is run from the V1 folder because the container needs both the backend and frontend folders.
cd ~/Raabta/V1docker build -f backend/Dockerfile -t raabta-backend:v1 .
Step 6: Run the Docker container locally
docker rm -f raabta-backend-container 2>/dev/nulldocker run -d \  -p 5000:5000 \  --name raabta-backend-container \  raabta-backend:v1
Step 7: Test the health endpoint locally
curl http://localhost:5000/health
Expected output:
{"status":"ok","message":"Raabta Backend is running"}
Step 8: Open the frontend locally
Open this URL in the browser:
http://localhost:5000
5. CI/CD Pipeline Explanation
The project uses GitHub Actions for CI/CD. The workflow file is located at:
.github/workflows/ci.yml
The pipeline runs automatically when code is pushed to the main branch or when a pull request is created for the main branch.
Pipeline Jobs
JobPurposetestInstalls backend dependencies and runs Jest/Supertest API testsbuild-dockerBuilds the Docker image, runs the container and checks the /health endpoint
Workflow Explanation
First, GitHub Actions checks out the repository. Then it sets up Node.js version 22. The pipeline moves into the backend folder and installs dependencies using npm install. After that, it runs the automated tests using npm test.
If the tests pass, the second job starts. The Docker build job builds the backend image using the Dockerfile. Then it starts the container on port 5000 and sends a curl request to:
http://localhost:5000/health
If the health endpoint responds successfully, the Docker job passes. If any test fails, the Docker build job does not run.
CI/CD File Used
name: Raabta Backend CI/CDon:  push:    branches:      - main  pull_request:    branches:      - mainjobs:  test:    name: Run Backend Tests    runs-on: ubuntu-latest    steps:      - name: Checkout repository        uses: actions/checkout@v4      - name: Set up Node.js        uses: actions/setup-node@v4        with:          node-version: 22      - name: Install backend dependencies        working-directory: ./V1/backend        run: npm install      - name: Run backend tests        working-directory: ./V1/backend        run: npm test  build-docker:    name: Build and Test Docker Image    runs-on: ubuntu-latest    needs: test    steps:      - name: Checkout repository        uses: actions/checkout@v4      - name: Build Docker image        working-directory: ./V1        run: docker build -f backend/Dockerfile -t raabta-backend:v1 .      - name: Run Docker container        run: docker run -d -p 5000:5000 --name raabta-backend-container raabta-backend:v1      - name: Wait for backend to start        run: sleep 5      - name: Test health endpoint inside Docker        run: curl -f http://localhost:5000/health      - name: Show Docker logs        if: always()        run: docker logs raabta-backend-container || true      - name: Stop Docker container        if: always()        run: docker stop raabta-backend-container || true
6. Deployment Steps
The application was deployed manually on AWS EC2 using Docker.
Step 1: Launch EC2 instance
The EC2 instance was launched with these settings:
Instance type: t2.microOperating system: Ubuntu Server 22.04 LTSStorage: 8 GiB gp3Auto assign public IP: enabled
Step 2: Configure security group
The inbound rules were configured as follows:
SSH          TCP   22     My IP or 0.0.0.0/0Custom TCP   TCP   5000   0.0.0.0/0
Port 22 allows SSH access. Port 5000 allows the deployed backend and frontend to be accessed from the browser.
Step 3: SSH into EC2
From the local machine:
chmod 400 your-key.pemssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
Step 4: Install Docker on EC2
sudo apt updatesudo apt install -y docker.iosudo systemctl start dockersudo systemctl enable dockersudo docker --version
Step 5: Clone the GitHub repository on EC2
git clone https://github.com/Shoaib2566/Raabta.gitcd Raabta
If using a branch:
git checkout add-backend-api-tests
Step 6: Build the Docker image on EC2
The Docker build was run from the V1 folder because the container needs both backend and frontend files.
cd ~/Raabta/V1sudo docker build -f backend/Dockerfile -t raabta-backend:v1 .
Step 7: Run the Docker container with environment variables
The Supabase credentials were passed as environment variables to the container. The service role key was not placed inside any frontend file or curl request.
sudo docker rm -f raabta-backend-container 2>/dev/nullsudo docker run -d \  -p 5000:5000 \  --restart=always \  --name raabta-backend-container \  -e SUPABASE_URL="YOUR_SUPABASE_URL" \  -e SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY" \  -e JWT_SECRET="raabta-secret-key" \  raabta-backend:v1
Step 8: Verify the container is running
sudo docker ps
Expected result shows the container running with port mapping:
0.0.0.0:5000->5000/tcp
Step 9: Test health endpoint on EC2
Inside EC2:
curl http://localhost:5000/health
Expected output:
{"status":"ok","message":"Raabta Backend is running"}
Step 10: Test from local machine using EC2 public IP
From local terminal:
curl http://YOUR_EC2_PUBLIC_IP:5000/health
Expected output:
{"status":"ok","message":"Raabta Backend is running"}
Step 11: Open frontend in browser
Open this URL:
http://YOUR_EC2_PUBLIC_IP:5000
The frontend page should load from the Docker container.
Step 12: Test POST request from local machine
A POST request was tested using curl:
curl -X POST http://YOUR_EC2_PUBLIC_IP:5000/api/auth/signup \-H "Content-Type: application/json" \-d '{"email":"test@example.com"}'
Expected response:
{"error":"All fields are required"}
This confirms that the backend accepts POST requests and performs validation.
7. Testing Evidence
The project includes automated tests using Jest and Supertest.
The test file is located at:
V1/backend/tests/server.test.js
The tests cover the following cases:
Status CodeEndpointPurpose200GET /healthConfirms backend health check works201POST /api/auth/signupConfirms signup route can create a user when mocked successfully400POST /api/auth/signupConfirms validation works when required fields are missing401GET /api/customer/dashboardConfirms protected route blocks unauthenticated access404GET /api/orders/track/:orderIdConfirms missing order handling500GET /api/servicesConfirms database error handling
Local test command
cd ~/Raabta/V1/backendnpm test
Expected result:
PASS tests/server.test.jsTests: 6 passed, 6 total
Docker test command
cd ~/Raabta/V1docker build -f backend/Dockerfile -t raabta-backend:v1 .docker run -d -p 5000:5000 --name raabta-backend-container raabta-backend:v1curl http://localhost:5000/health
Expected result:
{"status":"ok","message":"Raabta Backend is running"}
EC2 test commands
sudo docker pscurl http://localhost:5000/health
From local machine:
curl http://YOUR_EC2_PUBLIC_IP:5000/health
8. Challenges and Solutions
Challenge 1: Docker container exited immediately
At first, the Docker container exited as soon as it started. The issue was found by checking the container logs:
docker logs raabta-backend-container
The logs showed that Node.js 20 did not provide the required native WebSocket support for the Supabase client. The solution was to use Node.js 22 in the Dockerfile.
FROM node:22-slim
After rebuilding the Docker image with Node.js 22, the container stayed running successfully.
Challenge 2: Frontend could not be found inside Docker
The frontend initially failed with an error similar to:
ENOENT: no such file or directory, stat '/frontend/index.html'
This happened because Docker was being built from the backend folder only, so the frontend folder was not copied into the image. The solution was to build Docker from the V1 folder and update the Dockerfile to copy both backend and frontend folders.
COPY backend ./backendCOPY frontend ./frontend
The build command was changed to:
docker build -f backend/Dockerfile -t raabta-backend:v1 .
from the V1 folder.
Challenge 3: Frontend login failed after deployment
The frontend loaded in the browser, but login failed because the frontend JavaScript was pointing to localhost.
The old value was:
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';
The fix was:
const API_BASE_URL = window.API_BASE_URL || `${window.location.origin}/api`;
This made the frontend call the same EC2 public IP from which it was loaded.
Challenge 4: Port 5000 was not initially accessible from browser
The backend worked inside EC2, but the browser could not access the public URL. The issue was the EC2 security group. Port 22 was open for SSH, but port 5000 was not open for the application. The solution was to add this inbound rule:
Custom TCP   5000   0.0.0.0/0
After saving the rule, the health endpoint was accessible from the internet.
9. Lessons Learned


A Docker container can build successfully but still fail at runtime, so checking docker logs is very important.


When a backend serves frontend files, the Docker image must include both the backend and frontend folders.


In a deployed frontend, localhost does not mean the EC2 server. It means the user’s own browser machine, so frontend API URLs should use window.location.origin.


Environment variables such as Supabase URL and service role key should be passed to the Docker container and should not be exposed inside frontend code or curl requests.


GitHub Actions is useful because it checks tests and Docker builds before deployment, reducing the chance of deploying broken code.


AWS security groups control whether the deployed app is reachable from the internet. Docker port mapping alone is not enough unless the EC2 security group also allows that port.


Before committing:```bashcd ~/Raabtatouch deployment_document.mdcode deployment_document.md
Paste the content, save it, then:
git add deployment_document.mdgit commit -m "Add deployment documentation"git push origin main
If your final work is still on your branch, use:
git push origin add-backend-api-tests
