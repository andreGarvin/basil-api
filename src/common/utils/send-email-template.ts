import { promisify } from "util";
import { resolve } from "path";
import { readFile } from "fs";

// promisifying the async readFile method
const readFileAsync = promisify(readFile);

import * as sendgrid from "@sendgrid/mail";
import handlebars from "handlebars";

// utils
import logger from "../logger";
import { MailData } from "@sendgrid/helpers/classes/mail";

// providing the send grid api with the API KEY
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

export const NO_REPLY = process.env.NO_REPLY || "Pivot <no-reply@pivotlms.com>";

handlebars.registerHelper("Badge", (name: string) => {
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
});

// directory path where all the templates located
const TEMPLATES_PATH = resolve(__dirname, "..", "..", "templates");

export enum TEMPLATES {
  // workspace email templates
  NEW_WOKRSPACE = "workspace/new-workspace-created",
  WORKSPACE_INVITATION = "workspace/workspace-invite",

  // authentication email templates
  RESET_PASSWORD = "authentication/password-reset",
  ACCOUNT_VERIFICATION = "authentication/account-verification",
  PASSWORD_UPDATE = "authentication/password-update",

  // invitaton email templates
  INVITATON = "invitation/invitation",

  // registry  email templates
  NEW_SCHOOL_REGISTRED = "registry/new-school-registred"
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

// this sends a bluk of email templates
export async function sendBlukEmailTemplate(
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
