package com.nexacrm.selenium.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;

public class LoginPageObject {
    private final WebDriver driver;
    private final WebDriverWait wait;
    private final String baseUrl;

    public LoginPageObject(WebDriver driver, WebDriverWait wait, String baseUrl) {
        this.driver = driver;
        this.wait = wait;
        this.baseUrl = baseUrl;
    }

    public void open() {
        driver.get(baseUrl + "/login");
    }

    public void openPlatformLogin() {
        driver.get(baseUrl + "/platform/login");
    }

    public WebElement emailField() {
        return wait.until((d) -> d.findElement(By.cssSelector("input[type='email']")));
    }

    public WebElement passwordField() {
        return wait.until((d) -> d.findElement(By.cssSelector("input[autocomplete='current-password']")));
    }

    public WebElement currentPasswordField() {
        return wait.until((d) -> d.findElement(By.cssSelector("input[autocomplete='current-password']")));
    }

    public WebElement submitButton() {
        return driver.findElement(By.cssSelector("button[type='submit']"));
    }

    public WebElement rememberMeCheckbox() {
        return driver.findElement(By.cssSelector("input[type='checkbox']"));
    }

    public WebElement registerLink() {
        return driver.findElement(By.cssSelector("a[href='/register']"));
    }

    public WebElement platformLoginLink() {
        return driver.findElement(By.cssSelector("a[href='/platform/login']"));
    }

    public void login(String email, String password) {
        open();
        emailField().clear();
        emailField().sendKeys(email);
        passwordField().clear();
        passwordField().sendKeys(password);
        submitButton().click();
    }

    public void platformLogin(String email, String password) {
        openPlatformLogin();
        emailField().clear();
        emailField().sendKeys(email);
        passwordField().clear();
        passwordField().sendKeys(password);
        submitButton().click();
    }
}
