import * as uuid from "uuid/v4";

import { Document, Schema, model } from "mongoose";

// types
import { RegistratedSchool } from "./types";

export interface RegistratedSchoolModel extends RegistratedSchool, Document {
  id: string;
}

const registrySchema = new Schema({
  // id of the school
  id: {
    // generating random id string
    default: () => uuid(process.env.HOST, uuid.URL),
    required: true,
    type: String
  },

  // the type of school that was inserted into the registry
  type: String,

  /* This is the schools license key, currently used to indentify
  admins and professors when creating a account.
  
  NOTE: This will be more relevent when the anayltics dashboard is created
  for handling billing schools
  */
  license_key: {
    default: () => uuid(process.env.HOST, uuid.URL),
    type: String
  },

  /* the email domain of the school

    This resticts admins and professors from inviting users to the
    school if they do not have the same email domain as the school
  */
  domain: String,

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

export default model<RegistratedSchoolModel>("registries", registrySchema);
