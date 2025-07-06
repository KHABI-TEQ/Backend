export const formatLandOwnerDataForTable = (user: any) => {
  return {
    id: user._id,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    phoneNumber: user.phoneNumber,
    accountStatus: user.accountStatus,
    isVerified: user.isAccountVerified,
    isApproved: user.accountApproved,
    isFlagged: user.isFlagged,
    userType: user.userType,
    accountId: user.accountId,
    createdAt: new Date(user.createdAt).toLocaleDateString(),
  };
};

export const formatAgentDataForTable = (agent: any) => {
  const user = agent.userId;

  return {
    id: user?._id || '',
    fullName: `${user?.firstName || ''} ${user?.lastName || ''}`,
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    accountStatus: agent.accountStatus,
    isVerified: user?.isAccountVerified || false,
    isApproved: agent.accountApproved,
    agentType: agent.agentType,
    onBoarded: agent.accountApproved,
    location: {
      regions: agent.regionOfOperation?.join(", ") || '',
      localGovt: agent.address?.localGovtArea || '',
      state: agent.address?.state || '',
    },
    kyc: {
      govtIdType: agent.govtId?.typeOfId || '-',
      govtIdNumber: agent.govtId?.idNumber || '-',
      uploadedIdCount: agent.meansOfId?.length || 0,
    },
    createdAt: new Date(agent.createdAt).toLocaleDateString(),
  };
};

