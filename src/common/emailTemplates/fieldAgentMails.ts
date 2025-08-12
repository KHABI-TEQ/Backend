export const FieldAgentCreated = (firstName: string, email: string, password: string): string => {
  return `
    <h2 style="color:#09391C;">Welcome to the Team, ${firstName}!</h2>
    <p>Your Field Agent account has been created successfully.</p>
    <p>Here are your login details:</p>
    <ul style="line-height: 1.8;">
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Password:</strong> ${password}</li>
    </ul>
    <p>We strongly recommend that you log in and change your password immediately for security reasons.</p>
    <a href="https://www.khabiteqrealty.com/auth/login" style="display:inline-block;background-color:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:20px;">Log in to Your Dashboard</a>
  `;
};


export const DeleteFieldAgent = (fullNameOrEmail: string, reason: string): string => {
  return `
    <h2 style="color:#B00020;">Your Field Agent Account Has Been Deleted</h2>
    <p>Dear ${fullNameOrEmail},</p>
    <p>This is to inform you that your Field Agent account has been deleted from the system.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>If you believe this was a mistake or you have any questions, please contact support immediately.</p>
    <a href="mailto:support@khabiteqrealty.com" style="display:inline-block;background-color:#B00020;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;margin-top:20px;">Contact Support</a>
  `;
};


export const ToggleFieldAgentStatus = (
  fullNameOrEmail: string,
  isInactive: boolean,
  reason: string
): string => {
  return `
    <h2 style="color:${isInactive ? '#B00020' : '#09391C'};">
      Your Account Has Been ${isInactive ? 'Deactivated' : 'Activated'}
    </h2>
    <p>Hi ${fullNameOrEmail},</p>
    <p>Your Field Agent account has been <strong>${isInactive ? 'temporarily deactivated' : 're-activated'}</strong>.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>If you have questions or need further clarification, please reach out.</p>
    <a href="mailto:support@khabiteqrealty.com" style="display:inline-block;background-color:${isInactive ? '#B00020' : '#09391C'};color:white;padding:10px 16px;text-decoration:none;border-radius:6px;margin-top:20px;">Contact Support</a>
  `;
};


export const InspectionAssigned = (
  firstName: string,
  inspectionDate: string,
  inspectionTime: string
): string => {
  return `
    <h2 style="color:#09391C;">You Have a New Inspection</h2>
    <p>Hi ${firstName},</p>
    <p>A new inspection has been assigned to you:</p>
    <ul style="line-height: 1.8;">
      <li><strong>Date:</strong> ${inspectionDate}</li>
      <li><strong>Time:</strong> ${inspectionTime}</li>
    </ul>
    <p>Please check your dashboard for full details and prepare accordingly.</p>
    <a href="/field-agent/inspections" style="display:inline-block;background-color:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:20px;">View Inspection</a>
  `;
};


export const InspectionRemoved = (
  firstName: string,
  inspectionDate: string,
  inspectionTime: string
): string => {
  return `
    <h2 style="color:#B00020;">Inspection Removed</h2>
    <p>Hi ${firstName},</p>
    <p>The following inspection has been removed from your assignments:</p>
    <ul style="line-height: 1.8;">
      <li><strong>Date:</strong> ${inspectionDate}</li>
      <li><strong>Time:</strong> ${inspectionTime}</li>
    </ul>
    <p>If you have any questions, feel free to contact your supervisor.</p>
  `;
};
