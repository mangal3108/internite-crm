package com.nexacrm.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Selenium tests for the Login page (/login).
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LoginPageTest extends SeleniumBaseTest {

    @BeforeEach
    void goToLogin() {
        navigateTo("/login");
        waitForVisible(By.cssSelector("input[type='email']"));
    }

    @Test
    @Order(1)
    @DisplayName("Login page renders with expected elements")
    void loginPageLoads() {
        // Heading
        WebElement heading = waitForVisible(By.xpath("//*[contains(text(),'Welcome Back')]"));
        assertTrue(heading.isDisplayed());

        // Email & password fields
        assertTrue(elementExists(By.cssSelector("input[type='email']")));
        assertTrue(elementExists(By.cssSelector("input[type='password']")));

        // Submit button
        WebElement signInBtn = driver.findElement(By.cssSelector("button[type='submit']"));
        assertTrue(signInBtn.getText().contains("Sign In"));

        // Remember me checkbox
        assertTrue(elementExists(By.cssSelector("input[type='checkbox']")));

        // Register link
        WebElement registerLink = driver.findElement(By.cssSelector("a[href='/register']"));
        assertTrue(registerLink.isDisplayed());

        // Platform admin link
        WebElement platformLink = driver.findElement(By.cssSelector("a[href='/platform/login']"));
        assertTrue(platformLink.isDisplayed());
    }

    @Test
    @Order(2)
    @DisplayName("Email field is required")
    void emailFieldRequired() {
        WebElement emailInput = driver.findElement(By.cssSelector("input[type='email']"));

        // HTML5 required attribute
        String required = emailInput.getAttribute("required");
        assertNotNull(required);
    }

    @Test
    @Order(3)
    @DisplayName("Password field is required")
    void passwordFieldRequired() {
        WebElement passwordInput = driver.findElement(By.cssSelector("input[type='password']"));
        assertNotNull(passwordInput.getAttribute("required"));
    }

    @Test
    @Order(4)
    @DisplayName("Invalid email format is blocked by browser validation")
    void invalidEmailFormatIsBlocked() {
        WebElement emailInput = driver.findElement(By.cssSelector("input[type='email']"));
        WebElement passwordInput = driver.findElement(By.cssSelector("input[type='password']"));

        emailInput.sendKeys("not-an-email");
        passwordInput.sendKeys("test123");

        Boolean valid = (Boolean) ((JavascriptExecutor) driver)
            .executeScript("return arguments[0].checkValidity();", emailInput);

        assertFalse(valid, "Email input should reject invalid email format before submitting");

        driver.findElement(By.cssSelector("button[type='submit']")).click();
        assertTrue(driver.getCurrentUrl().contains("/login"));
    }

    @Test
    @Order(5)
    @DisplayName("Password visibility toggle works")
    void passwordToggle() {
        WebElement passwordInput = driver.findElement(By.cssSelector("input[type='password']"));
        passwordInput.sendKeys("test123");

        // Initially type=password
        assertEquals("password", passwordInput.getAttribute("type"));

        // Click the eye toggle button (sibling button inside the relative div)
        WebElement toggleBtn = passwordInput.findElement(By.xpath("following-sibling::button"));
        toggleBtn.click();

        // Now the input type should be text
        WebElement nowTextInput = driver.findElement(
            By.cssSelector("input[autocomplete='current-password']"));
        assertEquals("text", nowTextInput.getAttribute("type"));

        // Toggle back
        toggleBtn = nowTextInput.findElement(By.xpath("following-sibling::button"));
        toggleBtn.click();

        WebElement nowPwdInput = driver.findElement(
            By.cssSelector("input[autocomplete='current-password']"));
        assertEquals("password", nowPwdInput.getAttribute("type"));
    }

    @Test
    @Order(6)
    @DisplayName("Empty form submission doesn't navigate away")
    void emptySubmitStaysOnPage() {
        // Submit with empty fields (HTML5 validation should prevent)
        WebElement submitBtn = driver.findElement(By.cssSelector("button[type='submit']"));
        submitBtn.click();

        // Should still be on login page
        assertTrue(driver.getCurrentUrl().contains("/login"));
    }

    @Test
    @Order(7)
    @DisplayName("Forgot password explains reset process")
    void forgotPasswordShowsResetGuidance() {
        WebElement forgotPassword = driver.findElement(By.xpath("//button[contains(.,'Forgot password?')]"));
        forgotPassword.click();

        WebElement toast = waitForToastContaining("Password resets");
        assertTrue(toast.isDisplayed());
        assertTrue(driver.getCurrentUrl().contains("/login"));
    }

    @Test
    @Order(8)
    @DisplayName("Register link navigates to /register")
    void registerLinkWorks() {
        WebElement registerLink = driver.findElement(By.cssSelector("a[href='/register']"));
        registerLink.click();
        waitForUrlContains("/register");
        assertTrue(driver.getCurrentUrl().contains("/register"));
    }

    @Test
    @Order(9)
    @DisplayName("Platform login link navigates to /platform/login")
    void platformLoginLinkWorks() {
        WebElement platformLink = driver.findElement(By.cssSelector("a[href='/platform/login']"));
        platformLink.click();
        waitForUrlContains("/platform/login");
        assertTrue(driver.getCurrentUrl().contains("/platform/login"));
    }
}
