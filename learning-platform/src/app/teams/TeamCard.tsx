'use client';

import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  Avatar,
  Link as MuiLink,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import JoinTeamButton from './JoinTeamButton';
import LeaveTeamButton from './LeaveTeamButton';

interface TeamMember {
  id: string;
  user: {
    name: string | null;
    email: string;
  };
  role: string;
}

interface TeamChallenge {
  status: string;
}

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    description: string;
    status: string;
    maxMembers: number;
    members: TeamMember[];
    challenges: TeamChallenge[];
  };
}

export default function TeamCard({ team }: TeamCardProps) {
  const { data: session } = useSession();
  const isTeamFull = team.members.length >= team.maxMembers;
  const currentMember = team.members.find(member => member.user.email === session?.user?.email);
  const isMember = !!currentMember;
  const isLeader = currentMember?.role === 'LEADER';
  const hasOtherMembers = team.members.length > 1;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent>
        <Link href={`/teams/${team.id}`} style={{ textDecoration: 'none' }}>
          <MuiLink component="div" sx={{ cursor: 'pointer' }}>
            <Typography variant="h5" gutterBottom>
              {team.name}
            </Typography>
            <Typography color="text.secondary" paragraph>
              {team.description}
            </Typography>
          </MuiLink>
        </Link>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip
            label={team.status}
            color={team.status === 'ACTIVE' ? 'success' : 'default'}
            size="small"
          />
          <Typography variant="body2" color="text.secondary">
            {team.members.length}/{team.maxMembers} members
          </Typography>
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Team Members
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {team.members.map((member) => (
            <Box
              key={member.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {member.user.name?.[0]}
              </Avatar>
              <Box>
                <Typography variant="body2">
                  {member.user.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {member.role}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Active Challenges: {team.challenges.filter(c => c.status === 'ACTIVE').length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Completed: {team.challenges.filter(c => c.status === 'COMPLETED').length}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ mt: 'auto', p: 2, pt: 0 }}>
        {isMember ? (
          <LeaveTeamButton
            teamId={team.id}
            isLeader={isLeader}
            hasOtherMembers={hasOtherMembers}
          />
        ) : (
          <JoinTeamButton 
            teamId={team.id} 
            disabled={isTeamFull || team.status !== 'ACTIVE'} 
          />
        )}
      </CardActions>
    </Card>
  );
} 