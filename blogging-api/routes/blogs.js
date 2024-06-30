const express = require('express');
const jwt = require('jsonwebtoken');
const Blog = require('../models/Blog');
const User = require('../models/User');
const router = express.Router();

// Middleware for authenticating JWT
const authenticate = (req, res, next) => {
  const token = req.header('Authorization').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Calculate reading time
const calculateReadingTime = (text) => {
  const wordsPerMinute = 200;
  const words = text.split(' ').length;
  const time = Math.ceil(words / wordsPerMinute);
  return time;
};

// Get a list of published blogs
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort, filter } = req.query;
    const query = { state: 'published' };
    if (filter) {
      query.state = filter;
    }
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') },
        { author: new RegExp(search, 'i') },
      ];
    }
    const blogs = await Blog.find(query)
      .populate('author', 'first_name last_name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sort)
      .exec();
    const count = await Blog.countDocuments(query);
    res.status(200).json({
      blogs,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single published blog
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate('author', 'first_name last_name email');
    if (!blog || blog.state !== 'published') {
      return res.status(404).json({ message: 'Blog not found' });
    }
    blog.read_count += 1;
    await blog.save();
    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new blog
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, tags, body } = req.body;
    const reading_time = calculateReadingTime(body);
    const blog = new Blog({
      title,
      description,
      author: req.userId,
      tags,
      body,
      reading_time,
    });
    await blog.save();
    res.status(201).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update the state of a blog
router.patch('/:id/state', authenticate, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog || blog.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'You do not have permission to update this blog' });
    }
    blog.state = req.body.state;
    await blog.save();
    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit a blog
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog || blog.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'You do not have permission to edit this blog' });
    }
    Object.assign(blog, req.body);
    blog.reading_time = calculateReadingTime(blog.body);
    await blog.save();
    res.status(200).json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a blog
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog || blog.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this blog' });

