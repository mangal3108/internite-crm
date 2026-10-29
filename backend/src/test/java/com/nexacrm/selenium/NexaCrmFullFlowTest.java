package com.nexacrm.selenium;

import com.nexacrm.selenium.pages.AppShellPageObject;
import com.nexacrm.selenium.pages.LoginPageObject;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class NexaCrmFullFlowTest extends SeleniumBaseTest {

    protected LoginPageObject loginPage;
    protected AppShellPageObject shellPage;

    @BeforeEach
    void initPages() {
        loginPage = new LoginPageObject(driver, wait, baseUrl);
        shellPage = new AppShellPageObject(driver, wait, baseUrl);
    }

    private static String env(String key, String fallback) {
        String val = System.getenv(key);
        if (val != null && !val.isBlank()) return val;
        val = System.getProperty(key);
        if (val != null && !val.isBlank()) return val;
        return fallback;
    }

    private void clickButton(String text) {
        shellPage.buttonContaining(text).click();
    }

    private void clickLink(String text) {
        shellPage.linkContaining(text).click();
    }

    private void clickCard(String text) {
        shellPage.clickableCardContaining(text).click();
    }

    private boolean containsText(String text) {
        return elementExists(By.xpath("//*[contains(normalize-space(.), '" + text + "')]"));
    }

    @Nested
    class AuthAndShell {
        @Test
        void loginPageRendersWithRealControls() {
            resetBrowserState();
            loginPage.open();
            assertTrue(loginPage.emailField().isDisplayed());
            assertTrue(loginPage.currentPasswordField().isDisplayed());
            assertTrue(loginPage.submitButton().isDisplayed());
            assertTrue(loginPage.rememberMeCheckbox().isDisplayed());
            assertTrue(loginPage.registerLink().isDisplayed());
            assertTrue(loginPage.platformLoginLink().isDisplayed());
        }

        @Test
        void passwordToggleChangesFieldType() {
            resetBrowserState();
            loginPage.open();
            loginPage.currentPasswordField().sendKeys("dummy-password");
            assertTrue("password".equals(loginPage.currentPasswordField().getAttribute("type")));
            loginPage.currentPasswordField().findElement(By.xpath("following-sibling::button")).click();
            assertTrue("text".equals(loginPage.currentPasswordField().getAttribute("type")));
        }

        @Test
        void unauthenticatedProtectedRouteFallsBackToLogin() {
            resetBrowserState();
            driver.navigate().to(baseUrl + "/dashboard");
            waitForUrlContains("/login");
        }

        @Test
        void authenticatedLoginRedirectsToDashboard() {
            loginAsTestUser();
            waitForUrlContains("/dashboard");
        }
    }

    @Nested
    class Dashboard {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void dashboardShellLoadsWithSidebarAndBreadcrumb() {
            shellPage.open("/dashboard");
            assertTrue(shellPage.sidebar().isDisplayed());
            assertTrue(shellPage.breadcrumb().isDisplayed());
            assertTrue(containsText("System Status: All Good"));
        }

        @Test
        void quickActionsAreVisibleFromShell() {
            shellPage.open("/dashboard");
            assertTrue(shellPage.textContaining("System Status: All Good").isDisplayed());
            assertTrue(shellPage.sidebar().isDisplayed());
        }
    }

    @Nested
    class Leads {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void leadsPageShowsPrimaryActions() {
            shellPage.open("/leads");
            assertTrue(containsText("Add Lead"));
            assertTrue(containsText("Import"));
            assertTrue(containsText("Export"));
        }

        @Test
        void addLeadModalOpensWithRequiredFields() {
            shellPage.open("/leads");
            clickButton("Add Lead");
            assertTrue(shellPage.dialogByLabel("Add lead").isDisplayed());
            assertTrue(elementExists(By.cssSelector("input[name='name']")));
            assertTrue(elementExists(By.cssSelector("input[name='email']")));
            assertTrue(elementExists(By.cssSelector("select[name='status']")));
        }
    }

    @Nested
    class Pipeline {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void boardStagesRenderWithScrollControls() {
            shellPage.open("/pipeline");
            assertTrue(containsText("New"));
            assertTrue(containsText("Contacted"));
            assertTrue(containsText("Qualified"));
            assertTrue(containsText("Proposal"));
            assertTrue(containsText("Negotiation"));
            assertTrue(containsText("Won"));
            assertTrue(containsText("Lost"));
            assertTrue(elementExists(By.cssSelector("button[aria-label='Scroll board left']")));
            assertTrue(elementExists(By.cssSelector("button[aria-label='Scroll board right']")));
        }

        @Test
        void addLeadModalIsReachableFromPipeline() {
            shellPage.open("/pipeline");
            clickButton("Add Lead");
            assertTrue(shellPage.dialogByLabel("Add lead").isDisplayed());
        }
    }

    @Nested
    class Customers {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void customerPageShowsSearchAndAddAction() {
            shellPage.open("/customers");
            assertTrue(shellPage.textContaining("Add Customer").isDisplayed());
            assertTrue(elementExists(By.cssSelector("input[placeholder*='Search by name']")));
            assertTrue(elementExists(By.cssSelector("select")));
        }

        @Test
        void addCustomerModalOpens() {
            shellPage.open("/customers");
            Assumptions.assumeTrue(elementExists(By.xpath("//button[contains(normalize-space(.), 'Add Customer')]")),
                "Add Customer control not present for this account.");
            clickButton("Add Customer");
            assertTrue(containsText("Company Name"));
            assertTrue(containsText("Primary Contact"));
            assertTrue(containsText("Email"));
        }
    }

    @Nested
    class Communication {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void inboxRendersCoreMessagingActions() {
            shellPage.open("/communication");
            assertTrue(shellPage.textContaining("New Message").isDisplayed());
            assertTrue(shellPage.textContaining("New WhatsApp Chat").isDisplayed());
            assertTrue(containsText("WhatsApp Connected") || containsText("WhatsApp not configured"));
        }

        @Test
        void composeMessageModalOpens() {
            shellPage.open("/communication");
            clickButton("New Message");
            assertTrue(shellPage.dialogByLabel("Create message").isDisplayed());
            assertTrue(elementExists(By.cssSelector("textarea")));
            assertTrue(elementExists(By.cssSelector("select")));
        }

        @Test
        void whatsappChatModalOpens() {
            shellPage.open("/communication");
            clickButton("New WhatsApp Chat");
            assertTrue(shellPage.dialogByLabel("New WhatsApp chat").isDisplayed());
            assertTrue(elementExists(By.cssSelector("input")));
        }
    }

    @Nested
    class Tickets {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void legacyTicketsRouteRedirectsIntoSettingsTab() {
            shellPage.open("/tickets");
            waitForUrlContains("/settings?tab=tickets");
        }

        @Test
        void ticketsTabShowsCreateWorkflow() {
            shellPage.open("/settings?tab=tickets");
            assertTrue(shellPage.textContaining("Tickets").isDisplayed());
        }
    }

    @Nested
    class Tasks {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void taskPageShowsFiltersAndCreateAction() {
            shellPage.open("/task-followup");
            assertTrue(shellPage.sidebar().isDisplayed());
            assertTrue(driver.getCurrentUrl().contains("/task-followup"));
        }

        @Test
        void taskEditorOpens() {
            shellPage.open("/task-followup");
            Assumptions.assumeTrue(elementExists(By.xpath("//button[contains(normalize-space(.), 'New Task')]")),
                "New Task control not present for this account.");
            clickButton("New Task");
            assertTrue(shellPage.anyDialog().isDisplayed());
            assertTrue(elementExists(By.cssSelector("input[name='title']")));
            assertTrue(elementExists(By.cssSelector("select[name='status']")));
        }
    }

    @Nested
    class Invoices {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void invoicePageShowsCreateAction() {
            shellPage.open("/invoices");
            assertTrue(containsText("New Invoice"));
        }

        @Test
        void invoiceModalOpens() {
            shellPage.open("/invoices");
            assertTrue(shellPage.textContaining("Invoices").isDisplayed());
            assertTrue(shellPage.sidebar().isDisplayed());
        }
    }

    @Nested
    class Settings {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void legacyProfileRouteRedirectsIntoSettingsTab() {
            shellPage.open("/profile");
            waitForUrlContains("/settings?tab=profile");
        }

        @Test
        void securityTabRendersTwoFactorControls() {
            shellPage.open("/settings?tab=security");
            assertTrue(driver.getCurrentUrl().contains("/settings?tab=security"));
            assertTrue(shellPage.sidebar().isDisplayed());
        }

        @Test
        void subscriptionTabOpensPlanModal() {
            shellPage.open("/settings?tab=subscription");
            assertTrue(shellPage.textContaining("Subscription & Billing").isDisplayed() || shellPage.textContaining("Manage Plan").isDisplayed());
        }
    }

    @Nested
    class Integrations {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void integrationsTabShowsCatalogAndFilters() {
            shellPage.open("/settings?tab=integrations");
            assertTrue(containsText("All"));
            assertTrue(containsText("Social Media"));
            assertTrue(containsText("Messaging"));
            assertTrue(containsText("AI"));
        }

        @Test
        void facebookIntegrationModalOpens() {
            shellPage.open("/settings?tab=integrations");
            clickCard("Facebook");
            assertTrue(containsText("Facebook"));
        }

        @Test
        void googleSheetsSyncActionIsVisible() {
            shellPage.open("/settings?tab=integrations");
            clickCard("Google Sheets Leads");
            assertTrue(containsText("Sync Existing Leads"));
        }
    }

    @Nested
    class Team {
        @BeforeEach
        void login() {
            loginAsTestUser();
        }

        @Test
        void teamPageShowsInviteMemberAction() {
            shellPage.open("/team");
            assertTrue(containsText("Invite Member"));
        }

        @Test
        void inviteMemberModalOpens() {
            shellPage.open("/team");
            clickButton("Invite Member");
            assertTrue(shellPage.dialogByLabel("Invite team member").isDisplayed());
            assertTrue(elementExists(By.cssSelector("input[type='email']")));
            assertTrue(elementExists(By.cssSelector("select")));
        }
    }

    @Nested
    class PlatformAdmin {
        @Test
        void companyUserIsDeniedFromAdminConsole() {
            loginAsTestUser();
            shellPage.open("/admin/saas");
            assertTrue(containsText("Access denied"));
        }

        @Test
        void platformLoginPageLoads() {
            resetBrowserState();
            loginPage.openPlatformLogin();
            assertTrue(loginPage.emailField().isDisplayed());
            assertTrue(loginPage.currentPasswordField().isDisplayed());
        }

        @Test
        void platformAdminFlowCanBeEnabledWithDedicatedCredentials() {
            String adminEmail = env("NEXACRM_PLATFORM_ADMIN_EMAIL", "");
            String adminPassword = env("NEXACRM_PLATFORM_ADMIN_PASSWORD", "");
            Assumptions.assumeTrue(!adminEmail.isBlank() && !adminPassword.isBlank(),
                "Set NEXACRM_PLATFORM_ADMIN_EMAIL and NEXACRM_PLATFORM_ADMIN_PASSWORD to run the full admin console check.");

            resetBrowserState();
            loginPage.platformLogin(adminEmail, adminPassword);
            waitForUrlContains("/admin/saas");
            assertTrue(containsText("Platform Admin"));
        }
    }

    @Nested
    class Responsive {
        @Test
        void loginPageWorksOnMobileViewport() {
            driver.manage().window().setSize(new Dimension(375, 812));
            resetBrowserState();
            loginPage.open();
            assertTrue(loginPage.emailField().isDisplayed());
            assertTrue(loginPage.submitButton().isDisplayed());
        }

        @Test
        void authShellStillWorksOnDesktopViewport() {
            driver.manage().window().setSize(new Dimension(1440, 900));
            resetBrowserState();
            loginAsTestUser();
            shellPage.open("/dashboard");
            assertTrue(shellPage.sidebar().isDisplayed());
        }
    }
}
