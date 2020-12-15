import {Application} from "../../../support/application.config";
import {multiSlider, toolbar} from "../../../support/components/common";
import {createEditStepDialog, advancedSettings} from "../../../support/components/merging/index";
import curatePage from "../../../support/pages/curate";
import {confirmYesNo} from "../../../support/components/common/index";
import "cypress-wait-until";
import mergingStepDetail from "../../../support/components/merging/merging-step-detail";
import mergeStrategyModal from "../../../support/components/merging/merge-strategy-modal";
import mergeRuleModal from "../../../support/components/merging/merge-rule-modal";

describe("Merging", () => {

  beforeEach(() => {
    cy.visit("/");
    cy.contains(Application.title);
    cy.loginAsTestUserWithRoles("hub-central-flow-writer", "hub-central-match-merge-writer", "hub-central-mapping-writer", "hub-central-load-writer").withRequest();
    cy.waitUntil(() => toolbar.getCurateToolbarIcon()).click();
    cy.waitUntil(() => curatePage.getEntityTypePanel("Customer").should("be.visible"));
  });

  afterEach(() => {
    cy.resetTestUser();
  });

  after(() => {
    cy.loginAsDeveloper().withRequest();
    cy.deleteSteps("merging", "mergeOrderTestStep");
  });

  it("can create/edit a merge step within the merge tab of curate tile,can create merge strategies/rules, can delete merge strategies/rules ", () => {
    const mergeStep = "mergeOrderTestStep";

    //Navigating to merge tab
    curatePage.toggleEntityTypeId("Order");
    curatePage.selectMergeTab("Order");

    //Creating a new merge step
    cy.waitUntil(() => curatePage.addNewStep()).click();

    createEditStepDialog.stepNameInput().type(mergeStep);
    createEditStepDialog.stepDescriptionInput().type("merge order step example");
    createEditStepDialog.setSourceRadio("Query");
    createEditStepDialog.setQueryInput(`cts.collectionQuery(['${mergeStep}'])`);
    createEditStepDialog.setTimestampInput().type("/envelop/headers/createdOn");
    createEditStepDialog.saveButton("merging").click();
    curatePage.verifyStepNameIsVisible(mergeStep);

    //Editing the merge step
    curatePage.editStep(mergeStep).click();

    createEditStepDialog.stepNameInput().should("be.disabled");
    createEditStepDialog.stepDescriptionInput().should("have.value", "merge order step example");
    createEditStepDialog.setTimestampInput().should("have.value", "/envelop/headers/createdOn");

    //Editing the value to see if the confirmation dialogs are working fine.
    createEditStepDialog.stepDescriptionInput().clear().type("UPDATED - merge order step example");
    createEditStepDialog.cancelButton("merging").click();

    confirmYesNo.getDiscardText().should("be.visible");
    confirmYesNo.getYesButton().click();

    //Check if the changes are reverted back when discarded all changes.
    curatePage.editStep(mergeStep).click();
    createEditStepDialog.stepDescriptionInput().should("not.have.value", "UPDATED - merge order step example");

    // Test advanced settings
    curatePage.switchEditAdvanced().click();
    advancedSettings.setTargetCollection("onMerge", "discardedMerged");
    advancedSettings.discardTargetCollection("onMerge");
    cy.findAllByText("discardedMerged").should("not.exist");
    advancedSettings.cancelSettingsButton(mergeStep).click();
    confirmYesNo.getDiscardText().should("not.be.visible");

    curatePage.editStep(mergeStep).click();
    curatePage.switchEditAdvanced().click();
    advancedSettings.setTargetCollection("onMerge", "keptMerged");
    advancedSettings.keepTargetCollection("onMerge");
    cy.findAllByText("keptMerged").should("exist");
    advancedSettings.cancelSettingsButton(mergeStep).click();
    confirmYesNo.getDiscardText().should("be.visible");
    confirmYesNo.getNoButton().click();

    advancedSettings.saveSettingsButton(mergeStep).click();
    curatePage.editStep(mergeStep).click();
    curatePage.switchEditAdvanced().click();
    //cy.findAllByText('keptMerged').should('exist');
    advancedSettings.cancelSettingsButton(mergeStep).trigger("mouseover").dblclick();

    //open matching step details
    curatePage.openStepDetails(mergeStep);
    cy.contains("mergeOrderTestStep");

    //add strategy
    mergingStepDetail.addStrategyButton().click();
    mergeStrategyModal.setStrategyName("myFavourite");
    mergeStrategyModal.addSliderOptionsButton().click();
    multiSlider.getHandleName("Length").should("be.visible");
    mergeStrategyModal.saveButton().click();
    cy.findByText("myFavourite").should("exist");
    cy.findByText("myFavourite").click();
    //Edit strategy
    mergeStrategyModal.setStrategyName("myFavouriteEdited");
    mergeStrategyModal.saveButton().click();
    cy.findByText("myFavouriteEdited").should("exist");

    //delele strategy
    mergingStepDetail.getDeleteMergeStrategyButton("myFavouriteEdited").click();
    mergingStepDetail.getDeleteStrategyText().should("be.visible");
    mergingStepDetail.cancelMergeDeleteModalButton().click();
    cy.findByText("myFavouriteEdited").should("exist");
    mergingStepDetail.getDeleteMergeStrategyButton("myFavouriteEdited").click();
    mergingStepDetail.confirmMergeDeleteModalButton().click();
    cy.findByText("myFavouriteEdited").should("not.exist");

    //add merge rule of type custom
    mergingStepDetail.addMergeRuleButton().click();
    cy.contains("Add Merge Rule");
    mergeRuleModal.selectPropertyToMerge("orderId");
    mergeRuleModal.selectMergeTypeDropdown("Custom");
    mergeRuleModal.setUriText("/custom/merge/strategy.sjs");
    mergeRuleModal.setFunctionText("customMergeFunction");
    mergeRuleModal.saveButton().click();
    cy.findByText("orderId").should("exist");
    cy.findByText("orderId").click();
    //Edit merge rule of type custom
    mergeRuleModal.setFunctionText("customMergeFunctionEdited");
    mergeRuleModal.saveButton().click();

    //delele merge rule of type custom
    mergingStepDetail.getDeleteMergeRuleButton("orderId").click();
    mergingStepDetail.getDeleteMergeRuleText().should("be.visible");
    mergingStepDetail.cancelMergeDeleteModalButton().click();
    cy.findByText("orderId").should("exist");
    mergingStepDetail.getDeleteMergeRuleButton("orderId").click();
    mergingStepDetail.confirmMergeDeleteModalButton().click();
    cy.findByText("orderId").should("not.exist");

    //add merge rule of type strategy
    mergingStepDetail.addStrategyButton().click();
    mergeStrategyModal.setStrategyName("myFavouriteStrategy");
    mergeStrategyModal.saveButton().click();
    cy.findByText("myFavouriteStrategy").should("exist");
    mergingStepDetail.addMergeRuleButton().click();
    cy.contains("Add Merge Rule");
    mergeRuleModal.selectPropertyToMerge("shipRegion");
    mergeRuleModal.selectMergeTypeDropdown("Strategy");
    mergeRuleModal.selectStrategyName("myFavouriteStrategy");
    mergeRuleModal.saveButton().click();
    cy.findByText("shipRegion").should("exist");
    cy.findByText("shipRegion").click();
    //Edit merge rule of type strategy
    mergeRuleModal.selectPropertyToMerge("orderId");
    mergeRuleModal.saveButton().click();
    cy.findByText("orderId").should("exist");

    //delele merge rule of type custom
    mergingStepDetail.getDeleteMergeRuleButton("orderId").click();
    mergingStepDetail.getDeleteMergeRuleText().should("be.visible");
    mergingStepDetail.cancelMergeDeleteModalButton().click();
    cy.findByText("orderId").should("exist");
    mergingStepDetail.getDeleteMergeRuleButton("orderId").click();
    mergingStepDetail.confirmMergeDeleteModalButton().click();
    cy.findByText("orderId").should("not.exist");

    //add merge rule of type property-specific
    mergingStepDetail.addMergeRuleButton().click();
    cy.contains("Add Merge Rule");
    mergeRuleModal.selectPropertyToMerge("shippedDate");
    mergeRuleModal.selectMergeTypeDropdown("Property-specific");
    mergeRuleModal.addSliderOptionsButton().click();
    multiSlider.getHandleName("Length").should("be.visible");
    mergeRuleModal.saveButton().click();
    cy.findByText("shippedDate").should("exist");
    cy.findByText("shippedDate").click();

    //Edit merge rule of type property-specific
    mergeRuleModal.selectPropertyToMerge("shipRegion");
    mergeRuleModal.saveButton().click();
    cy.findByText("shipRegion").should("exist");

    //delele merge rule of type property-specific
    mergingStepDetail.getDeleteMergeRuleButton("shipRegion").click();
    mergingStepDetail.getDeleteMergeRuleText().should("be.visible");
    mergingStepDetail.cancelMergeDeleteModalButton().click();
    cy.findByText("shipRegion").should("exist");
    mergingStepDetail.getDeleteMergeRuleButton("shipRegion").click();
    mergingStepDetail.confirmMergeDeleteModalButton().click();
    cy.findByText("shipRegion").should("not.exist");
  });
});
