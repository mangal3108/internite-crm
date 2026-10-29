package com.nexacrm.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.By;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Selenium tests for sidebar navigation and page routing after login.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class NavigationTest extends SeleniumBaseTest {

    private static boolean loggedIn = false;

    @BeforeEach
    void ensureLoggedIn() {
        if (!loggedIn) {
            loginAsTestUser();
            loggedIn = true;
        }
    }

    @Test
    @Order(1)
    @DisplayName("Sidebar is visible after login")
    void sidebarVisible() {
        // Look for nav/aside element
        boolean hasSidebar = elementExists(By.tagName("aside"))
                || elementExists(By.tagName("nav"))
                || elementExists(By.cssSelector("[class*='sidebar']"));
        assertTrue(hasSidebar, "Sidebar or nav element should exist");
    }

    @Test
    @Order(2)
    @DisplayName("Navigate to Leads page")
    void navigateToLeads() {
        assertRouteRenders("/leads", "/leads", "Leads");
    }

    @Test
    @Order(3)
    @DisplayName("Navigate to Pipeline/Kanban page")
    void navigateToPipeline() {
        assertRouteRenders("/pipeline", "/pipeline", "Pipeline");
    }

    @Test
    @Order(4)
    @DisplayName("Navigate to Customers page")
    void navigateToCustomers() {
        assertRouteRenders("/customers", "/customers", "Customers");
    }

    @Test
    @Order(5)
    @DisplayName("Navigate to Tasks page")
    void navigateToTasks() {
        assertRouteRenders("/task-followup", "/task-followup", "Follow");
    }

    @Test
    @Order(6)
    @DisplayName("Navigate to Communication page")
    void navigateToCommunication() {
        assertRouteRenders("/communication", "/communication", "Messages");
    }

    @Test
    @Order(7)
    @DisplayName("Navigate to Invoices page")
    void navigateToInvoices() {
        assertRouteRenders("/invoices", "/invoices", "Invoices");
    }

    @Test
    @Order(8)
    @DisplayName("Navigate to Analytics page")
    void navigateToAnalytics() {
        assertRouteRenders("/analytics", "/analytics", "Analytics");
    }

    @Test
    @Order(9)
    @DisplayName("Navigate to Settings page")
    void navigateToSettings() {
        assertRouteRenders("/settings", "/settings", "Settings");
    }

    @Test
    @Order(10)
    @DisplayName("Navigate to AI Engine page")
    void navigateToAiEngine() {
        assertRouteRenders("/ai-engine", "/ai-engine", "AI");
    }

    @Test
    @Order(11)
    @DisplayName("Navigate to Automation page")
    void navigateToAutomation() {
        assertRouteRenders("/automation", "/automation", "Automation");
    }

    @Test
    @Order(12)
    @DisplayName("Navigate to Team page")
    void navigateToTeam() {
        assertRouteRenders("/team", "/team", "Team");
    }

    @Test
    @Order(13)
    @DisplayName("Navigate to Tickets page")
    void navigateToTickets() {
        assertRouteRenders("/tickets", "/settings", "Tickets");
    }

    @Test
    @Order(14)
    @DisplayName("Navigate to Profile page")
    void navigateToProfile() {
        assertRouteRenders("/profile", "/settings", "Profile");
    }

    @Test
    @Order(15)
    @DisplayName("Navigate to Integrations page")
    void navigateToIntegrations() {
        assertRouteRenders("/integrations", "/settings", "Integrations");
    }

    @Test
    @Order(16)
    @DisplayName("Unknown route redirects to dashboard or login")
    void unknownRouteRedirects() {
        navigateTo("/this-page-does-not-exist");
        wait.until(driver -> !driver.getCurrentUrl().contains("/this-page-does-not-exist"));

        String url = driver.getCurrentUrl();
        assertTrue(url.contains("/dashboard") || url.contains("/login") || url.contains("/admin"),
            "Unknown route should redirect, got: " + url);
    }

    private void assertRouteRenders(String path, String expectedUrlPart, String expectedBodyText) {
        navigateTo(path);
        waitForUrlContains(expectedUrlPart);
        waitForAppReady();
        waitForBodyText(expectedBodyText);

        String body = driver.findElement(By.tagName("body")).getText();
        assertFalse(body.contains("Checking session..."), path + " should not stay in auth loading");
        assertFalse(body.contains("Access denied"), path + " should be accessible to the Selenium test user");
        assertTrue(driver.getCurrentUrl().contains(expectedUrlPart),
            "Expected " + path + " to land on URL containing " + expectedUrlPart);
    }
}
