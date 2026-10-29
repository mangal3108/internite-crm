package com.nexacrm.selenium.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;

public class AppShellPageObject {
    private final WebDriver driver;
    private final WebDriverWait wait;
    private final String baseUrl;

    public AppShellPageObject(WebDriver driver, WebDriverWait wait, String baseUrl) {
        this.driver = driver;
        this.wait = wait;
        this.baseUrl = baseUrl;
    }

    public void open(String path) {
        driver.get(baseUrl + path);
    }

    public WebElement breadcrumb() {
        return wait.until((d) -> d.findElement(By.cssSelector("nav[aria-label='Breadcrumb']")));
    }

    public WebElement sidebar() {
        return wait.until((d) -> d.findElement(By.tagName("aside")));
    }

    public WebElement buttonContaining(String text) {
        return wait.until((d) -> d.findElement(By.xpath("//button[contains(normalize-space(.), '" + text + "')]")));
    }

    public WebElement linkContaining(String text) {
        return wait.until((d) -> d.findElement(By.xpath("//a[contains(normalize-space(.), '" + text + "')]")));
    }

    public WebElement clickableCardContaining(String text) {
        return wait.until((d) -> d.findElement(By.xpath(
            "//*[contains(normalize-space(.), '" + text + "')]/ancestor::div[contains(@class,'cursor-pointer')][1]"
        )));
    }

    public WebElement dialogByLabel(String label) {
        return wait.until((d) -> d.findElement(By.cssSelector("[role='dialog'][aria-label='" + label + "']")));
    }

    public WebElement anyDialog() {
        return wait.until((d) -> d.findElement(By.cssSelector("[role='dialog']")));
    }

    public WebElement textContaining(String text) {
        return wait.until((d) -> d.findElement(By.xpath("//*[contains(normalize-space(.), '" + text + "')]")));
    }
}
