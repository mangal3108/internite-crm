package com.nexacrm.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Selenium tests for the full authentication flow:
 * login → dashboard → sidebar navigation → protected routes.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthFlowTest extends SeleniumBaseTest {

    @Test
    @Order(1)
    @DisplayName("Successful login redirects to /dashboard")
    void loginSuccess() {
        clearBrowserSession();
        loginAsTestUser();
        assertTrue(driver.getCurrentUrl().contains("/dashboard"));
        assertTrue(elementExists(By.tagName("aside")), "Authenticated app shell should render the sidebar");
    }

    @Test
    @Order(2)
    @DisplayName("Dashboard shows after login")
    void dashboardRendersAfterLogin() {
        loginAsTestUser();

        waitForAnyVisible(
            By.xpath("//*[contains(text(),'Lead Conversion')]"),
            By.xpath("//*[contains(text(),'Dashboard')]"),
            By.cssSelector("main")
        );

        String body = driver.findElement(By.tagName("body")).getText();
        assertFalse(body.contains("Checking session..."),
            "Dashboard should have loaded, not stuck on session check");
        assertFalse(body.contains("Access denied"),
            "Test account should have dashboard permission");
    }

    @Test
    @Order(3)
    @DisplayName("Unauthenticated user is redirected to /login")
    void unauthRedirectsToLogin() {
        clearBrowserSession();

        navigateTo("/dashboard");

        // Should redirect to login
        waitForUrlContains("/login");
        assertTrue(driver.getCurrentUrl().contains("/login"));
    }

    @Test
    @Order(4)
    @DisplayName("Invalid credentials show error toast")
    void invalidCredentialsShowError() {
        navigateTo("/login");

        WebElement emailInput = waitForVisible(By.cssSelector("input[type='email']"));
        emailInput.clear();
        emailInput.sendKeys("wrong@example.com");

        WebElement passwordInput = driver.findElement(By.cssSelector("input[type='password']"));
        passwordInput.clear();
        passwordInput.sendKeys("wrongpassword");

        WebElement submitBtn = driver.findElement(By.cssSelector("button[type='submit']"));
        submitBtn.click();

        waitForToastContaining("failed");

        assertTrue(driver.getCurrentUrl().contains("/login"),
            "Should remain on login page after failed login");
        assertFalse(submitBtn.isEnabled() && driver.getCurrentUrl().contains("/dashboard"),
            "Invalid credentials must not authenticate the user");
    }
}
