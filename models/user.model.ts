import { User } from "../../core/models/user.model";
import { Professional } from "./professional.model";

export interface SistfdUser extends User {
    professional?: Professional;
}
