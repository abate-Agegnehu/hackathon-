'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  CircularProgress,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import SendIcon from '@mui/icons-material/Send';

interface Message {
  id: number;
  content: string;
  sentAt: string;
  sender: {
    name: string | null;
    email: string;
  };
}

interface TeamChatProps {
  teamId: string;
}

export default function TeamChat({ teamId }: TeamChatProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    try {
      console.log('Fetching messages for team:', teamId);
      const response = await fetch(`/api/teams/${teamId}/messages`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Server error:', data);
        throw new Error(data.error || 'Failed to fetch messages');
      }
      
      console.log(`Fetched ${data.length} messages`);
      setMessages(data);
      setLoading(false);
      setError(''); // Clear any existing errors
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to load messages');
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMessages();
    // Set up polling for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      setError(''); // Clear any existing errors
      const response = await fetch(`/api/teams/${teamId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setMessages([...messages, data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      // Don't clear the message input in case of error so user can try again
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => {
            setError('');
            setLoading(true);
            fetchMessages();
          }}
          sx={{ mt: 2 }}
        >
          Try Again
        </Button>
      </Paper>
    );
  }

  return (
    <Paper sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Team Chat</Typography>
      </Box>

      {/* Messages List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <List>
          {messages.map((message) => {
            const isCurrentUser = message.sender.email === session?.user?.email;
            
            return (
              <ListItem
                key={message.id}
                sx={{
                  flexDirection: 'column',
                  alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
                  gap: 1,
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexDirection: isCurrentUser ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {message.sender.name?.[0]}
                  </Avatar>
                  <Typography variant="caption" color="text.secondary">
                    {message.sender.name} • {new Date(message.sentAt).toLocaleString()}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    maxWidth: '70%',
                    backgroundColor: isCurrentUser ? 'primary.main' : 'grey.100',
                    color: isCurrentUser ? 'white' : 'text.primary',
                    borderRadius: 2,
                    p: 1.5,
                    alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Typography>{message.content}</Typography>
                </Box>
              </ListItem>
            );
          })}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      {/* Message Input */}
      <Box
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          endIcon={<SendIcon />}
          disabled={!newMessage.trim()}
        >
          Send
        </Button>
      </Box>
    </Paper>
  );
} 