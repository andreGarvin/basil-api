import { Schema, Model, Document, model } from "mongoose";

// types
import { AdminMember } from "../types";

interface RegistratedSchoolAdminModel extends AdminMember, Document {}

const registryAdminMemberSchema = new Schema({
  // the admin user id
  user_id: {
    required: true,
    type: String
  },

  // the id of the school they are admin of
  school_id: {
    required: true,
    type: String
  }
});

export default model<RegistratedSchoolAdminModel>(
  "registry_admin_members",
  registryAdminMemberSchema
);
