import { neon } from "@netlify/neon";

const sql = neon();

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { httpMethod, path, body } = event;
    const segments = path.split('/').filter(Boolean);
    const todoId = segments[segments.length - 1];

    switch (httpMethod) {
      case 'GET':
        // Get all todos
        const todos = await sql`
          SELECT id, text, completed, created_at 
          FROM todos 
          ORDER BY created_at DESC
        `;
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(todos),
        };

      case 'POST':
        // Create a new todo
        const { text } = JSON.parse(body);
        if (!text || !text.trim()) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Todo text is required' }),
          };
        }

        const [newTodo] = await sql`
          INSERT INTO todos (text, completed, created_at)
          VALUES (${text.trim()}, false, NOW())
          RETURNING id, text, completed, created_at
        `;

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newTodo),
        };

      case 'PUT':
        // Update a todo
        if (!todoId || isNaN(parseInt(todoId))) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Valid todo ID is required' }),
          };
        }

        const updateData = JSON.parse(body);
        const { completed } = updateData;

        if (typeof completed !== 'boolean') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Completed status must be a boolean' }),
          };
        }

        const [updatedTodo] = await sql`
          UPDATE todos 
          SET completed = ${completed}
          WHERE id = ${parseInt(todoId)}
          RETURNING id, text, completed, created_at
        `;

        if (!updatedTodo) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Todo not found' }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedTodo),
        };

      case 'DELETE':
        // Delete a todo
        if (!todoId || isNaN(parseInt(todoId))) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Valid todo ID is required' }),
          };
        }

        const [deletedTodo] = await sql`
          DELETE FROM todos 
          WHERE id = ${parseInt(todoId)}
          RETURNING id
        `;

        if (!deletedTodo) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Todo not found' }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Todo deleted successfully' }),
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error in todos function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
    };
  }
};
