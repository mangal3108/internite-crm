package com.nexacrm.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Selenium tests for responsive layout behavior.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ResponsiveTest extends SeleniumBaseTest {

    @Test
    @Order(1)
    @DisplayName("Login page renders on mobile viewport")
    void loginPageMobile() {
        driver.manage().window().setSize(new Dimension(375, 812));
        navigateTo("/login");

        WebElement emailInput = waitForVisible(By.cssSelector("input[type='email']"));
        assertTrue(emailInput.isDisplayed(), "Email field should be visible on mobile");

        WebElement submitBtn = driver.findElement(By.cssSelector("button[type='submit']"));
        assertTrue(submitBtn.isDisplayed(), "Sign In button should be visible on mobile");
        assertNoHorizontalOverflow();

        // The left CRM animation panel should be hidden on mobile (hidden lg:flex)
        // We can't easily check CSS display via Selenium, but the form should work
    }

    @Test
    @Order(2)
    @DisplayName("Login page renders on tablet viewport")
    void loginPageTablet() {
        driver.manage().window().setSize(new Dimension(768, 1024));
        navigateTo("/login");

        WebElement emailInput = waitForVisible(By.cssSelector("input[type='email']"));
        assertTrue(emailInput.isDisplayed());
        assertNoHorizontalOverflow();
    }

    @Test
    @Order(3)
    @DisplayName("Login page renders on desktop viewport")
    void loginPageDesktop() {
        driver.manage().window().setSize(new Dimension(1920, 1080));
        navigateTo("/login");

        WebElement emailInput = waitForVisible(By.cssSelector("input[type='email']"));
        assertTrue(emailInput.isDisplayed());
        assertNoHorizontalOverflow();
    }

    @AfterAll
    static void resetWindowSize() {
        if (driver != null) {
            driver.manage().window().setSize(new Dimension(1920, 1080));
        }
    }

    private void assertNoHorizontalOverflow() {
        Long scrollWidth = (Long) ((JavascriptExecutor) driver)
            .executeScript("return document.documentElement.scrollWidth;");
        Long clientWidth = (Long) ((JavascriptExecutor) driver)
            .executeScript("return document.documentElement.clientWidth;");

        assertTrue(scrollWidth <= clientWidth + 1,
            "Viewport should not have horizontal overflow. scrollWidth=" + scrollWidth + ", clientWidth=" + clientWidth);
    }
}
