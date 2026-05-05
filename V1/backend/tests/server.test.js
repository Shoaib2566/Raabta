const request = require("supertest");

let mockScenario = "default";
let appUsersSingleCallCount = 0;

const mockFrom = jest.fn((table) => {
    const chain = {
        select: jest.fn(() => chain),

        eq: jest.fn(() => {
            if (mockScenario === "services-500" && table === "services") {
                return Promise.resolve({
                    data: null,
                    error: new Error("Database error")
                });
            }

            return chain;
        }),

        single: jest.fn(() => {
            if (mockScenario === "signup-201" && table === "app_users") {
                appUsersSingleCallCount += 1;

                if (appUsersSingleCallCount === 1) {
                    return Promise.resolve({
                        data: null,
                        error: null
                    });
                }

                return Promise.resolve({
                    data: {
                        user_id: 1,
                        email: "test@example.com",
                        role: "customer"
                    },
                    error: null
                });
            }

            if (mockScenario === "track-404" && table === "orders") {
                return Promise.resolve({
                    data: null,
                    error: new Error("Order not found")
                });
            }

            return Promise.resolve({
                data: null,
                error: null
            });
        }),

        insert: jest.fn(() => chain),
        update: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        in: jest.fn(() => chain),
        gte: jest.fn(() => chain),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
    };

    return chain;
});

jest.mock("@supabase/supabase-js", () => ({
    createClient: jest.fn(() => ({
        from: mockFrom
    }))
}));

const app = require("../server");

describe("Raabta Backend API Tests", () => {
    beforeEach(() => {
        mockScenario = "default";
        appUsersSingleCallCount = 0;
        mockFrom.mockClear();
    });

    test("200: GET /health should return backend health status", async () => {
        const response = await request(app).get("/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("ok");
        expect(response.body.message).toBe("Raabta Backend is running");
    });

    test("201: POST /api/auth/signup should create user successfully", async () => {
        mockScenario = "signup-201";

        const response = await request(app)
            .post("/api/auth/signup")
            .send({
                full_name: "Test User",
                email: "test@example.com",
                password: "password123",
                role: "customer"
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe("User created successfully");
        expect(response.body.user.email).toBe("test@example.com");
        expect(response.body.user.role).toBe("customer");
    });

    test("400: POST /api/auth/signup should return 400 when required fields are missing", async () => {
        const response = await request(app)
            .post("/api/auth/signup")
            .send({
                email: "test@example.com"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toBe("All fields are required");
    });

    test("401: GET /api/customer/dashboard should fail without token", async () => {
        const response = await request(app).get("/api/customer/dashboard");

        expect(response.statusCode).toBe(401);
        expect(response.body.error).toBe("Access token required");
    });

    test("404: GET /api/orders/track/:orderId should return order not found", async () => {
        mockScenario = "track-404";

        const response = await request(app).get("/api/orders/track/ORD-999");

        expect(response.statusCode).toBe(404);
        expect(response.body.error).toBe("Order not found");
    });

    test("500: GET /api/services should return server error when database fails", async () => {
        mockScenario = "services-500";

        const response = await request(app).get("/api/services");

        expect(response.statusCode).toBe(500);
        expect(response.body.error).toBe("Database error");
    });
});