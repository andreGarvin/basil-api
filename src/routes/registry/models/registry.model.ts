import { Document, Schema, Model, model } from "mongoose";

// types
import { RegistratedSchool } from "../types";

export interface RegistratedSchoolModel extends RegistratedSchool, Document {
  id: string;
}

const registrySchema = new Schema({
  // the type of school that was inserted into the registry
  type: String,

  /* This is the schools license key, currently used to indentify
    admins and professors when creating a account.

    NOTE: This will be more relevent when the anayltics dashboard is created
    for handling billing schools
  */
  license_key: String,

  /* the email domain of the school

    This resticts admins and professors from inviting users to the
    school if they do not have the same email domain as the school
  */
  domain: String,

  id: {
    required: true,
    type: String
  },

  // The name of the school
  name: {
    required: true,
    type: String
  },

  // a time stamp to when the school was created
  created_at: {
    default: () => new Date().toISOString(),
    type: Date
  },

  // NOTE: This will be more relevent when the anayltics dashboard is created
  deactivated: {
    default: false,
    type: Boolean
  }
});

export default model<RegistratedSchoolModel>("registry", registrySchema);
