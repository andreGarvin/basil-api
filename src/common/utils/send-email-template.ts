import { promisify } from "util";
import { resolve } from "path";
import { readFile } from "fs";

// promisifying the async readFile method
const readFileAsync = promisify(readFile);

import { MailData } from "@sendgrid/helpers/classes/mail";
import * as sendgrid from "@sendgrid/mail";
import * as handlebars from "handlebars";

// utils
import logger from "../logger";

// config
import { NO_REPLY } from "../../config";

// providing the send grid api with the API KEY
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

handlebars.registerHelper("Badge", (name: string) => {
  if (name) {
    // grabbing the name name of the school or class
    name = handlebars.Utils.escapeExpression(name);

    // getting the first character of the name
    const firstCharacter: string = name[0].toUpperCase();
    // generating a random color for the invitation email
    const randomColor: string = (0x1000000 + Math.random() * 0xffffff)
      .toString(16)
      .substr(1, 6);

    // this is to created a badge each invitation or notification that is sent out
    return new handlebars.SafeString(`
      <div id="badge" style="background-color: #${randomColor}">
        <p style='margin: 10px 25px 10px 20px;'>${firstCharacter}</p>
      </div>
    `);
  }
});

// directory path where all the templates located
const TEMPLATES_PATH = resolve(__dirname, "..", "..", "..", "templates");

export enum TEMPLATES {
  // invitaton email templates
  INVITATON = "invitation/invitation",
  ADMIN_INVITATION = "invitation/admin-invitation",

  // authentication email templates
  ACCOUNT_PASSWORD_RESET = "authentication/password-reset",
  ACCOUNT_PASSWORD_UPDATE = "authentication/password-update",
  ACCOUNT_REACTIVATION = "authentication/account-reactivation",
  ACCOUNT_VERIFICATION = "authentication/account-verification",

  // workspace email templates
  // NEW_WOKRSPACE = "notification/new-workspace-created",
  WORKSPACE_INVITATION = "workspace/workspace-invite",
  ACCEPTED_WORKSPACE_MEMBER_REQUEST = "workspace/accepted-workspace-request"
}

interface EmailBody extends MailData {
  subject: string;
  from: string;
  cc?: string[];
  bcc?: string[];
  to: string;
}

/**
 * This function sends a constructed email template. Taking the email body and the
 * optiomal template variables
 */
export async function sendEmailTemplate(
  templateName: string,
  body: EmailBody,
  templateVariables?: { [key: string]: any }
): Promise<string> {
  try {
    const templatePath: string = resolve(
      TEMPLATES_PATH,
      `${templateName}.handlebars`
    );

    // reads the template from disk
    const templateString: string = await readFileAsync(templatePath, "utf8");
    // creates a template constructor
    const templateConstructor = handlebars.compile(templateString);

    const compiledTemplate: string = templateConstructor({
      body,
      variables: templateVariables
    });

    if (process.env.NODE_ENV !== "test") {
      body.from = NO_REPLY;

      await sendgrid.send({
        ...body,
        html: compiledTemplate
      });
    }

    return compiledTemplate;
  } catch (err) {
    logger.child({ error: err }).error("Failed to send email template");

    throw err;
  }
}

// this sends a bulk of email templates
export async function sendbulkEmailTemplate(
  templateName: string,
  emails: {
    body: EmailBody;
    templateVariables?: { [key: string]: any };
  }[]
): Promise<void> {
  try {
    const templatePath: string = resolve(
      TEMPLATES_PATH,
      `${templateName}.handlebars`
    );
    // reads the template from disk
    const templateString: string = await readFileAsync(templatePath, "utf8");
    // creates a template constructor
    const templateConstructor = handlebars.compile(templateString);

    for (let { body, templateVariables } of emails) {
      const compiledTemplate: string = templateConstructor({
        body,
        variables: templateVariables
      });

      if (process.env.NODE_ENV !== "test") {
        body.from = NO_REPLY;

        await sendgrid.send({
          ...body,
          html: compiledTemplate
        });
      }
    }
  } catch (err) {
    logger.child({ error: err }).error("Failed to send email template");

    throw err;
  }
}
